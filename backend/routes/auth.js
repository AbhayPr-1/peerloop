const express = require('express');
const crypto = require('crypto');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const MAX_CHALLENGES_PER_WINDOW = 10;
const MAX_RATE_LIMIT_ENTRIES = 5000;
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const challengeRateLimits = new Map();

function limitChallengeRequests(req, res, next) {
  const now = Date.now();
  const key = req.socket.remoteAddress || 'unknown';
  let entry = challengeRateLimits.get(key);

  if (!entry || now >= entry.resetAt) {
    if (!entry && challengeRateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
      for (const [address, limit] of challengeRateLimits) {
        if (now >= limit.resetAt) challengeRateLimits.delete(address);
      }
      if (challengeRateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
        return res.status(429).json({ msg: 'Too many sign-in requests. Try again later.' });
      }
    }
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
  }

  if (entry.count >= MAX_CHALLENGES_PER_WINDOW) {
    return res.status(429).json({ msg: 'Too many sign-in requests. Try again later.' });
  }
  entry.count += 1;
  challengeRateLimits.set(key, entry);
  return next();
}

function normalizeWalletAddress(value) {
  if (typeof value !== 'string' || !ethers.isAddress(value)) return null;
  return ethers.getAddress(value).toLowerCase();
}

function buildLoginMessage(walletAddress, nonce) {
  return [
    'PeerLoop sign-in request',
    `Origin: ${APP_ORIGIN}`,
    `Address: ${walletAddress}`,
    `Nonce: ${nonce}`
  ].join('\n');
}

router.post('/nonce', limitChallengeRequests, async (req, res) => {
  const walletAddress = normalizeWalletAddress(req.body?.walletAddress);
  if (!walletAddress) {
    return res.status(400).json({ msg: 'A valid wallet address is required.' });
  }

  try {
    const addressPattern = new RegExp(`^${walletAddress}$`, 'i');
    let user = await User.findOne({ walletAddress: addressPattern });

    if (!user) {
      const suffix = crypto.randomBytes(4).toString('hex');
      user = new User({
        name: `User-${walletAddress.slice(2, 8)}-${suffix}`,
        walletAddress
      });
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    user.loginNonce = nonce;
    user.loginNonceExpiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    await user.save();

    res.set('Cache-Control', 'no-store');
    return res.json({ message: buildLoginMessage(walletAddress, nonce) });
  } catch (err) {
    console.error('Wallet challenge creation failed:', err.message);
    return res.status(500).json({ msg: 'Could not start wallet sign-in.' });
  }
});

router.post('/metamask', async (req, res) => {
  const walletAddress = normalizeWalletAddress(req.body?.walletAddress);
  const { signature } = req.body || {};
  if (!walletAddress || typeof signature !== 'string' || !signature) {
    return res.status(400).json({ msg: 'A valid wallet address and signature are required.' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ msg: 'Wallet sign-in is not configured on the server.' });
  }

  try {
    const addressPattern = new RegExp(`^${walletAddress}$`, 'i');
    const user = await User.findOne({ walletAddress: addressPattern })
      .select('+loginNonce +loginNonceExpiresAt');
    if (!user || !user.loginNonce || !user.loginNonceExpiresAt || user.loginNonceExpiresAt <= new Date()) {
      return res.status(401).json({ msg: 'Sign-in challenge expired. Please try again.' });
    }

    const message = buildLoginMessage(walletAddress, user.loginNonce);
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
    } catch (_) {
      return res.status(401).json({ msg: 'Wallet signature is not valid.' });
    }
    if (recoveredAddress !== walletAddress) {
      return res.status(401).json({ msg: 'Wallet signature does not match the requested address.' });
    }

    // Consume the challenge atomically so it cannot be replayed.
    const replacementNonce = crypto.randomBytes(32).toString('hex');
    const authenticatedUser = await User.findOneAndUpdate(
      { _id: user._id, loginNonce: user.loginNonce, loginNonceExpiresAt: { $gt: new Date() } },
      { $set: { walletAddress, loginNonce: replacementNonce, loginNonceExpiresAt: null } },
      { new: true }
    );
    if (!authenticatedUser) {
      return res.status(401).json({ msg: 'Sign-in challenge has already been used. Please try again.' });
    }

    const payload = {
      authVersion: 2,
      user: {
        id: authenticatedUser.id,
        name: authenticatedUser.name,
        walletAddress: authenticatedUser.walletAddress
      }
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) {
        console.error('JWT creation failed:', err.message);
        return res.status(500).json({ msg: 'Could not complete wallet sign-in.' });
      }
      return res.json({ token, user: payload.user });
    });
  } catch (err) {
    console.error('Wallet sign-in failed:', err.message);
    return res.status(500).json({ msg: 'Server error during wallet sign-in.' });
  }
});

module.exports = router;
