// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  walletAddress: { type: String, unique: true, required: true },
  // Cart is now managed in frontend localStorage
});

module.exports = mongoose.model('User', UserSchema);