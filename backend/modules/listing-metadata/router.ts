import express from 'express';
import { createListingMetadataController } from './listingMetadataController';
import type { createListingMetadataService } from './listingMetadataService';

const auth = require('../../middleware/authMiddleware');

export function createListingMetadataRouter(
  service: ReturnType<typeof createListingMetadataService>
) {
  const router = express.Router();
  const controller = createListingMetadataController(service);
  router.get('/', controller.list);
  router.post('/', auth, controller.save);
  return router;
}
