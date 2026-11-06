const express = require('express');
const { ethers } = require('ethers');
const ListingMetadata = require('../models/ListingMetadata');
const auth = require('../middleware/authMiddleware');

const router = express.Router();
const CATEGORIES = new Set(['electronics', 'wearables', 'cybernetics', 'data', 'gadgets', 'others']);
const PRODUCT_ABI = [
  'function products(uint256) view returns (uint256 id, string name, string description, uint256 price, string imageUrl, address seller, address buyer, bool isSold)'
];

function getContractAddress() {
  const address = process.env.CONTRACT_ADDRESS;
  if (!ethers.isAddress(address || '')) return null;
  return ethers.getAddress(address).toLowerCase();
}

router.get('/', async (_req, res) => {
  const contractAddress = getContractAddress();
  if (!contractAddress) {
    return res.status(503).json({ msg: 'Listing categories are not configured on the server.' });
  }

  try {
    const records = await ListingMetadata.find({ contractAddress }).select('productId category -_id').lean();
    return res.set('Cache-Control', 'no-store').json(
      Object.fromEntries(records.map(({ productId, category }) => [productId, category]))
    );
  } catch (error) {
    console.error('Could not load listing categories:', error.message);
    return res.status(500).json({ msg: 'Could not load listing categories.' });
  }
});

router.post('/', auth, async (req, res) => {
  const contractAddress = getContractAddress();
  const { productId, category } = req.body || {};
  const sellerWallet = req.user.walletAddress;

  if (!contractAddress) {
    return res.status(503).json({ msg: 'Listing categories are not configured on the server.' });
  }
  if (!/^[1-9]\d*$/.test(String(productId || '')) || !CATEGORIES.has(category)) {
    return res.status(400).json({ msg: 'A valid product ID and category are required.' });
  }
  if (!ethers.isAddress(sellerWallet || '')) {
    return res.status(401).json({ msg: 'Your account does not have a valid wallet address. Sign in again.' });
  }
  if (!process.env.SEPOLIA_RPC_URL) {
    return res.status(503).json({ msg: 'Listing category verification is not configured on the server.' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const contract = new ethers.Contract(contractAddress, PRODUCT_ABI, provider);
    const product = await contract.products(productId);
    if (product.seller.toLowerCase() !== sellerWallet.toLowerCase()) {
      return res.status(403).json({ msg: 'You can only set the category for your own listing.' });
    }

    await ListingMetadata.findOneAndUpdate(
      { contractAddress, productId: String(productId) },
      { $set: { sellerWallet, category } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ productId: String(productId), category });
  } catch (error) {
    console.error('Could not save listing category:', error.message);
    return res.status(502).json({ msg: 'Could not verify or save the listing category.' });
  }
});

module.exports = router;
