import { ethers } from 'ethers';
import { createMongooseListingMetadataRepository } from './listingMetadataRepository';
import { marketplaceReader } from './marketplaceReader';
import { createListingMetadataService } from './listingMetadataService';
import { createListingMetadataRouter } from './router';

export {
  createListingMetadataService,
  ListingMetadataError
} from './listingMetadataService';
export { createListingMetadataRouter } from './router';
export type {
  ListingCategory,
  ListingMetadataDependencies,
  ListingMetadataRecord,
  ListingMetadataRepository,
  MarketplaceReader
} from './listingMetadataService';

function getContractAddress(): string | null {
  const address = process.env.CONTRACT_ADDRESS;
  if (!ethers.isAddress(address || '')) return null;
  return ethers.getAddress(address).toLowerCase();
}

const service = createListingMetadataService({
  repository: createMongooseListingMetadataRepository(),
  marketplace: marketplaceReader,
  getContractAddress,
  getRpcUrl: () => process.env.SEPOLIA_RPC_URL
});

export default createListingMetadataRouter(service);
