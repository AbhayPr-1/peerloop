// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator'); // Import validator functions
const User = require('../models/User');
const router = express.Router();

// Register
router.post('/register', [
  // --- VALIDATION RULES ---
  body('name', 'Name is required and must be at least 3 characters').not().isEmpty().trim().isLength({ min: 3 }),
  body('email', 'Please include a valid email').isEmail().normalizeEmail(),
  body('password', 'Password must be at least 6 characters').isLength({ min: 6 })
], async (req, res) => {
  // --- VALIDATION CHECK ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ $or: [{ email }, { name }] });
    if (user) return res.status(400).json({ msg: 'User with this email or name already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ name, email, password: hashedPassword });
    await user.save();

    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name } });
    });
  } catch (err) { res.status(500).send('Server error'); }
});

// Login
router.post('/login', [
  // --- VALIDATION RULES ---
  body('identifier', 'Email or Username is required').not().isEmpty(),
  body('password', 'Password is required').exists()
], async (req, res) => {
  // --- VALIDATION CHECK ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { identifier, password } = req.body;
  try {
    let user = await User.findOne({ $or: [{ email: identifier }, { name: identifier }] });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name } });
    });
  } catch (err) { res.status(500).send('Server error'); }
});

// MetaMask Login/Register
router.post('/metamask', [
    // --- VALIDATION RULE ---
    body('walletAddress', 'Wallet address is required and must be a valid Ethereum address').not().isEmpty().isEthereumAddress()
], async (req, res) => {
    // --- VALIDATION CHECK ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { walletAddress } = req.body;
    try {
        let user = await User.findOne({ walletAddress });
        if (!user) {
            const name = `User-${walletAddress.slice(2, 8)}`;
            user = new User({ name, email: `${walletAddress}@peerloop.io`, password: await bcrypt.hash(walletAddress, 10), walletAddress });
            await user.save();
        }
        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, name: user.name } });
        });
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;