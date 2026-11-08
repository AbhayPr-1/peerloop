import express from 'express';

const authRouter = require('../modules/auth').default;
const uploadRouter = require('../modules/uploads').default;
const listingMetadataRouter = require('../modules/listing-metadata').default;
const publicConfigRouter = require('../modules/public-config').default;

export function createApiRouter() {
  const router = express.Router();

  router.use('/auth', authRouter);
  router.use('/upload', uploadRouter);
  router.use('/listing-metadata', listingMetadataRouter);
  router.use('/config', publicConfigRouter);

  return router;
}
