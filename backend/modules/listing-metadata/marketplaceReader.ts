const { ethers } = require('ethers');
import type { MarketplaceReader } from './listingMetadataService';

const PRODUCT_ABI = [
  'function products(uint256) view returns (uint256 id, string name, string description, uint256 price, string imageUrl, address seller, address buyer, bool isSold)'
];

export const marketplaceReader: MarketplaceReader = {
  async getProductSeller(contractAddress, productId, rpcUrl) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, PRODUCT_ABI, provider);
    const product = await contract.products(productId);
    return product.seller;
  }
};
