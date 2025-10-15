// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// --- METAMASK LOGIN / REGISTER ---
router.post('/metamask', async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) {
        return res.status(400).json({ msg: 'Wallet address is required' });
    }

    try {
        let user = await User.findOne({ walletAddress });

        // If user does not exist, create a new one
        if (!user) {
            const name = `User-${walletAddress.slice(2, 8).toLowerCase()}`;
            
            // Check if generated name already exists, append random numbers if it does
            let finalName = name;
            let nameExists = await User.findOne({ name: finalName });
            while (nameExists) {
                finalName = `${name}-${Math.floor(Math.random() * 1000)}`;
                nameExists = await User.findOne({ name: finalName });
            }

            user = new User({ 
                name: finalName, 
                walletAddress: walletAddress 
            });
            await user.save();
        }

        const payload = {
            user: { id: user.id, name: user.name, walletAddress: user.walletAddress }
        };

        jwt.sign(
            payload, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }, 
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: payload.user });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;