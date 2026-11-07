const User = require('../../models/User');
import type { AuthUserRepository } from './authService';

export function createMongooseAuthUserRepository(): AuthUserRepository {
  return {
    findByWallet(walletAddress, includeChallenge = false) {
      const addressPattern = new RegExp(`^${walletAddress}$`, 'i');
      const query = User.findOne({ walletAddress: addressPattern });
      return includeChallenge
        ? query.select('+loginNonce +loginNonceExpiresAt')
        : query;
    },

    async createUser(name, walletAddress) {
      const user = new User({ name, walletAddress });
      await user.save();
      return user;
    },

    async saveChallenge(userId, nonce, expiresAt) {
      const user = await User.findById(userId);
      if (!user) throw new Error('Wallet account disappeared while creating its sign-in challenge.');
      user.loginNonce = nonce;
      user.loginNonceExpiresAt = expiresAt;
      await user.save();
    },

    consumeChallenge(userId, nonce, now) {
      return User.findOneAndUpdate(
        { _id: userId, loginNonce: nonce, loginNonceExpiresAt: { $gt: now } },
        { $set: { loginNonce: require('crypto').randomBytes(32).toString('hex'), loginNonceExpiresAt: null } },
        { new: true }
      );
    }
  };
}
