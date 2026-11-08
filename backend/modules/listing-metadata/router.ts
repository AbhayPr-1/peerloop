import express from 'express';
import { createListingMetadataController } from './listingMetadataController';
import type { createListingMetadataService } from './listingMetadataService';

const defaultAuth = require('../../middleware/authMiddleware');

export function createListingMetadataRouter(
  service: ReturnType<typeof createListingMetadataService>,
  auth: typeof defaultAuth = defaultAuth
) {
  const router = express.Router();
  const controller = createListingMetadataController(service);
  router.get('/', controller.list);
  router.post('/', auth, controller.save);
  return router;
}
