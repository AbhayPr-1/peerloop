import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { MAX_IMAGE_BYTES, isValidImage } from './imageValidation';
import { UploadServiceError } from './uploadService';
import type { createUploadService } from './uploadService';

const defaultAuth = require('../../middleware/authMiddleware');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 }
});

export function createUploadRouter(
  uploadService: ReturnType<typeof createUploadService>,
  auth: typeof defaultAuth = defaultAuth
) {
  const router = express.Router();
  const maxConcurrentUploads = 4;
  let activeUploads = 0;

  function limitConcurrentUploads(req: Request, res: Response, next: NextFunction) {
    if (activeUploads >= maxConcurrentUploads) {
      res.set('Retry-After', '2');
      return res.status(503).json({ msg: 'Image upload capacity is busy. Try again shortly.' });
    }

    activeUploads += 1;
    let released = false;
    const releaseSlot = () => {
      if (released) return;
      released = true;
      activeUploads = Math.max(0, activeUploads - 1);
    };
    res.once('finish', releaseSlot);
    req.once('aborted', () => {
      if (!res.locals.uploadServiceStarted) releaseSlot();
    });
    res.locals.releaseUploadSlot = releaseSlot;
    return next();
  }

  function receiveImage(req: Request, res: Response, next: NextFunction) {
    upload.single('productImage')(req, res, (error: unknown) => {
      if (error) {
        const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
        return res.status(tooLarge ? 413 : 400).json({
          msg: tooLarge ? 'Image must be 5 MB or smaller.' : 'Upload one valid image file.'
        });
      }
      if (!req.file) return res.status(400).json({ msg: 'No file uploaded.' });
      if (!isValidImage(req.file.buffer, req.file.mimetype)) {
        return res.status(400).json({ msg: 'Upload a valid JPEG, PNG, GIF, or WebP image.' });
      }
      return next();
    });
  }

  router.post('/', auth, limitConcurrentUploads, receiveImage, async (req, res) => {
    const releaseUploadSlot = res.locals.releaseUploadSlot as (() => void) | undefined;
    res.locals.uploadServiceStarted = true;
    try {
      const result = await uploadService.uploadImage(
        req.file!.buffer,
        req.file!.mimetype,
        req.file!.originalname
      );
      return res.json(result);
    } catch (error) {
      if (error instanceof UploadServiceError) {
        if (error.logMessage) console.error(error.logMessage);
        return res.status(error.statusCode).json({ msg: error.message });
      }
      console.error('Image upload failed:', error instanceof Error ? error.message : error);
      return res.status(500).json({ msg: 'Image upload failed.' });
    } finally {
      releaseUploadSlot?.();
    }
  });

  return router;
}
