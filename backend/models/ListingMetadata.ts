const mongoose = require('mongoose');

const ListingMetadataSchema = new mongoose.Schema({
  contractAddress: { type: String, required: true, lowercase: true },
  productId: { type: String, required: true },
  sellerWallet: { type: String, required: true, lowercase: true },
  category: {
    type: String,
    required: true,
    enum: ['electronics', 'wearables', 'cybernetics', 'data', 'gadgets', 'others']
  }
}, { timestamps: true });

ListingMetadataSchema.index({ contractAddress: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model('ListingMetadata', ListingMetadataSchema);
