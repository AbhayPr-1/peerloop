const ListingMetadata = require('../../models/ListingMetadata');
import type {
  ListingCategory,
  ListingMetadataRepository,
  ListingMetadataRecord
} from './listingMetadataService';

export function createMongooseListingMetadataRepository(): ListingMetadataRepository {
  return {
    async list(contractAddress): Promise<ListingMetadataRecord[]> {
      return ListingMetadata.find({ contractAddress })
        .select('productId category -_id')
        .lean();
    },

    async save(contractAddress, productId, sellerWallet, category: ListingCategory) {
      await ListingMetadata.updateOne(
        { contractAddress, productId },
        { $set: { sellerWallet, category } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }
  };
}
