const express = require('express');
const multer = require('multer');
const { Readable } = require('stream');
const path = require('path');
const pinataSDK = require('@pinata/sdk');
const auth = require('../middleware/authMiddleware');

const router = express.Router();
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function createPinataClient() {
  if (process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET) {
    return new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);
  }
  if (process.env.PINATA_JWT) {
    return new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 }
});

function matchesImageSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/gif') return buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/) !== null;
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

function receiveImage(req, res, next) {
  upload.single('productImage')(req, res, (err) => {
    if (err) {
      const tooLarge = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        msg: tooLarge ? 'Image must be 5 MB or smaller.' : 'Upload one valid image file.'
      });
    }
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded.' });
    if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype) || !matchesImageSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ msg: 'Upload a valid JPEG, PNG, GIF, or WebP image.' });
    }
    return next();
  });
}

router.post('/', auth, receiveImage, async (req, res) => {
  let pinata;
  try {
    pinata = createPinataClient();
  } catch (err) {
    console.error('Pinata client configuration error:', err.message);
    return res.status(503).json({ msg: 'Image uploads are not configured correctly.' });
  }
  if (!pinata) {
    return res.status(503).json({ msg: 'Image uploads are not configured on the server.' });
  }

  const stream = Readable.from(req.file.buffer);
  stream.path = path.basename(req.file.originalname || 'product-image');
  const options = { pinataMetadata: { name: stream.path.slice(0, 120) } };

  try {
    const result = await pinata.pinFileToIPFS(stream, options);
    const imageUrl = `ipfs://${result.IpfsHash}`;
    return res.json({ imageUrl, ipfsHash: result.IpfsHash });
  } catch (err) {
    console.error('Pinata upload error:', err.message);
    return res.status(502).json({ msg: 'Image upload to Pinata failed.' });
  }
});

module.exports = router;
