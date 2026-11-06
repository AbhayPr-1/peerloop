const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  walletAddress: { type: String, unique: true, required: true, lowercase: true, trim: true },
  loginNonce: { type: String, default: null, select: false },
  loginNonceExpiresAt: { type: Date, default: null, select: false },
  cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
});

module.exports = mongoose.model('User', UserSchema);
