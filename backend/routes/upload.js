// backend/routes/upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Readable } = require('stream');
const pinataSDK = require('@pinata/sdk');
const auth = require('../middleware/authMiddleware');

const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/', [auth, upload.single('productImage')], async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded.' });
  }

  const stream = Readable.from(req.file.buffer);
  stream.path = req.file.originalname; // SDK requires a path property
  const options = { pinataMetadata: { name: req.file.originalname } };

  try {
    const result = await pinata.pinFileToIPFS(stream, options);
    const imageUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
    res.json({ imageUrl: imageUrl, ipfsHash: result.IpfsHash });
  } catch (err) {
    console.error("Pinata upload error:", err);
    res.status(500).send('Server error during image upload.');
  }
});

module.exports = router;