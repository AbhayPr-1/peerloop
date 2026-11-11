const User = require('../../models/User');
import type { AuthUser, AuthUserRepository } from './authService';

export function createMongooseAuthUserRepository(): AuthUserRepository {
  function toAuthUser(user): AuthUser | null {
    if (!user) return null;
    return {
      id: String(user._id || user.id),
      name: user.name,
      walletAddress: user.walletAddress,
      ...(user.loginNonce !== undefined ? { loginNonce: user.loginNonce } : {}),
      ...(user.loginNonceExpiresAt !== undefined ? { loginNonceExpiresAt: user.loginNonceExpiresAt } : {})
    };
  }

  return {
    async findByWallet(walletAddress, includeChallenge = false) {
      // Wallets are normalized to lowercase before reaching the repository. An
      // exact match uses the schema's unique index; a case-insensitive regex does not.
      const projection = includeChallenge
        ? '_id name walletAddress +loginNonce +loginNonceExpiresAt'
        : '_id name walletAddress';
      const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() })
        .select(projection)
        .lean();
      return toAuthUser(user);
    },

    async createUser(name, walletAddress) {
      const user = new User({ name, walletAddress });
      await user.save();
      return toAuthUser(user)!;
    },

    async saveChallenge(userId, nonce, expiresAt) {
      const result = await User.updateOne(
        { _id: userId },
        { $set: { loginNonce: nonce, loginNonceExpiresAt: expiresAt } },
        { runValidators: true }
      );
      if (result.matchedCount === 0) {
        throw new Error('Wallet account disappeared while creating its sign-in challenge.');
      }
    },

    async consumeChallenge(userId, nonce, now) {
      const user = await User.findOneAndUpdate(
        { _id: userId, loginNonce: nonce, loginNonceExpiresAt: { $gt: now } },
        { $set: { loginNonce: require('crypto').randomBytes(32).toString('hex'), loginNonceExpiresAt: null } },
        { new: true }
      ).select('_id name walletAddress').lean();
      return toAuthUser(user);
    }
  };
}
