import type { Request, Response } from 'express';
import { ListingMetadataError } from './listingMetadataService';
import type { createListingMetadataService } from './listingMetadataService';

export function createListingMetadataController(
  service: ReturnType<typeof createListingMetadataService>
) {
  return {
    async list(_req: Request, res: Response) {
      try {
        const categories = await service.listCategories();
        return res.set('Cache-Control', 'no-store').json(categories);
      } catch (error) {
        if (error instanceof ListingMetadataError) {
          if (error.logMessage) console.error(error.logMessage);
          return res.status(error.statusCode).json({ msg: error.message });
        }
        console.error('Could not load listing categories:', error);
        return res.status(500).json({ msg: 'Could not load listing categories.' });
      }
    },

    async save(req: Request, res: Response) {
      try {
        const result = await service.setCategory(
          req.body?.productId,
          req.body?.category,
          req.user?.walletAddress
        );
        return res.json(result);
      } catch (error) {
        if (error instanceof ListingMetadataError) {
          if (error.logMessage) console.error(error.logMessage);
          return res.status(error.statusCode).json({ msg: error.message });
        }
        console.error('Could not save listing category:', error);
        return res.status(502).json({ msg: 'Could not verify or save the listing category.' });
      }
    }
  };
}
