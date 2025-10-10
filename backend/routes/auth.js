// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
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
router.post('/login', async (req, res) => {
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
router.post('/metamask', async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ msg: 'Wallet address required' });
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