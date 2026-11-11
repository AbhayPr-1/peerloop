const { ethers } = require('ethers');
import type { MarketplaceReader } from './listingMetadataService';

const PRODUCT_ABI = [
  'function products(uint256) view returns (uint256 id, string name, string description, uint256 price, string imageUrl, address seller, address buyer, bool isSold)'
];

// Reuse ethers providers and their underlying HTTP connection pools instead of
// creating a new provider for every category update.
const readers = new Map<string, { provider: any; contracts: Map<string, any> }>();

function getContract(contractAddress: string, rpcUrl: string) {
  let reader = readers.get(rpcUrl);
  if (!reader) {
    reader = { provider: new ethers.JsonRpcProvider(rpcUrl), contracts: new Map() };
    readers.set(rpcUrl, reader);
  }
  const key = contractAddress.toLowerCase();
  let contract = reader.contracts.get(key);
  if (!contract) {
    contract = new ethers.Contract(contractAddress, PRODUCT_ABI, reader.provider);
    reader.contracts.set(key, contract);
  }
  return contract;
}

export const marketplaceReader: MarketplaceReader = {
  async getProductSeller(contractAddress, productId, rpcUrl) {
    const contract = getContract(contractAddress, rpcUrl);
    const product = await contract.products(productId);
    return product.seller;
  }
};
