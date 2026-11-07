const { ethers } = require('ethers');

export type ListingCategory =
  | 'electronics'
  | 'wearables'
  | 'cybernetics'
  | 'data'
  | 'gadgets'
  | 'others';

export interface ListingMetadataRecord {
  productId: string;
  category: ListingCategory;
}

export interface ListingMetadataRepository {
  list(contractAddress: string): Promise<ListingMetadataRecord[]>;
  save(
    contractAddress: string,
    productId: string,
    sellerWallet: string,
    category: ListingCategory
  ): Promise<void>;
}

export interface MarketplaceReader {
  getProductSeller(contractAddress: string, productId: string, rpcUrl: string): Promise<string>;
}

export interface ListingMetadataDependencies {
  repository: ListingMetadataRepository;
  marketplace: MarketplaceReader;
  getContractAddress(): string | null;
  getRpcUrl(): string | undefined;
}

const CATEGORIES = new Set<ListingCategory>([
  'electronics',
  'wearables',
  'cybernetics',
  'data',
  'gadgets',
  'others'
]);

export class ListingMetadataError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly logMessage?: string
  ) {
    super(message);
    this.name = 'ListingMetadataError';
  }
}

export function createListingMetadataService(dependencies: ListingMetadataDependencies) {
  async function listCategories(): Promise<Record<string, ListingCategory>> {
    const contractAddress = dependencies.getContractAddress();
    if (!contractAddress) {
      throw new ListingMetadataError(503, 'Listing categories are not configured on the server.');
    }

    try {
      const records = await dependencies.repository.list(contractAddress);
      return Object.fromEntries(records.map(({ productId, category }) => [productId, category]));
    } catch (error) {
      throw new ListingMetadataError(
        500,
        'Could not load listing categories.',
        `Could not load listing categories: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async function setCategory(
    productIdValue: unknown,
    categoryValue: unknown,
    sellerWalletValue: unknown
  ): Promise<{ productId: string; category: ListingCategory }> {
    const contractAddress = dependencies.getContractAddress();
    if (!contractAddress) {
      throw new ListingMetadataError(503, 'Listing categories are not configured on the server.');
    }

    const productId = String(productIdValue || '');
    if (!/^[1-9]\d*$/.test(productId) || !CATEGORIES.has(categoryValue as ListingCategory)) {
      throw new ListingMetadataError(400, 'A valid product ID and category are required.');
    }
    if (!ethers.isAddress(typeof sellerWalletValue === 'string' ? sellerWalletValue : '')) {
      throw new ListingMetadataError(
        401,
        'Your account does not have a valid wallet address. Sign in again.'
      );
    }

    const rpcUrl = dependencies.getRpcUrl();
    if (!rpcUrl) {
      throw new ListingMetadataError(
        503,
        'Listing category verification is not configured on the server.'
      );
    }

    const category = categoryValue as ListingCategory;
    const sellerWallet = sellerWalletValue as string;
    try {
      const listingSeller = await dependencies.marketplace.getProductSeller(
        contractAddress,
        productId,
        rpcUrl
      );
      if (listingSeller.toLowerCase() !== sellerWallet.toLowerCase()) {
        throw new ListingMetadataError(
          403,
          'You can only set the category for your own listing.'
        );
      }

      await dependencies.repository.save(
        contractAddress,
        productId,
        sellerWallet,
        category
      );
      return { productId, category };
    } catch (error) {
      if (error instanceof ListingMetadataError) throw error;
      throw new ListingMetadataError(
        502,
        'Could not verify or save the listing category.',
        `Could not save listing category: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { listCategories, setCategory };
}
