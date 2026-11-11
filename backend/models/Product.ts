// backend/models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  imageUrl: { type: String, required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['for-sale', 'sold'], default: 'for-sale' },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// Support the filter + newest-first query shapes used by the retained product
// and user routers without changing their API behavior.
ProductSchema.index({ status: 1, createdAt: -1 });
ProductSchema.index({ seller: 1, status: 1, createdAt: -1 });
ProductSchema.index({ buyer: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Product', ProductSchema);
