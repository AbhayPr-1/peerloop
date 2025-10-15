// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  // Email and password are now optional
  email: { type: String, unique: true, sparse: true }, // sparse allows uniqueness on non-null values
  password: { type: String },
  // WalletAddress is the primary identifier for Web3 users
  walletAddress: { type: String, unique: true, sparse: true },
  cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
});

module.exports = mongoose.model('User', UserSchema);