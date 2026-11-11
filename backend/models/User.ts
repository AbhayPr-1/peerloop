const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  walletAddress: { type: String, unique: true, required: true, lowercase: true, trim: true },
  loginNonce: { type: String, default: null, select: false },
  loginNonceExpiresAt: { type: Date, default: null, select: false },
  cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
});

// Supports the legacy product buy/delete cleanup query that removes a product
// ID from every user's cart.
UserSchema.index({ cart: 1 });

module.exports = mongoose.model('User', UserSchema);
