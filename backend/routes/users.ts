// backend/routes/users.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Product = require('../models/Product');

// --- Get user's cart ---
router.get('/cart', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('cart');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user.cart);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- Add an item to the cart ---
router.post('/cart/:productId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const product = await Product.findById(req.params.productId);

    if (!user || !product) {
      return res.status(404).json({ msg: 'User or Product not found' });
    }
    if (product.status === 'sold') {
      return res.status(400).json({ msg: 'This product has already been sold.' });
    }
    if (user.cart.includes(product._id)) {
      return res.status(400).json({ msg: 'Product already in cart' });
    }

    user.cart.push(product._id);
    await user.save();
    
    await user.populate('cart');
    res.json(user.cart);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- Remove an item from the cart ---
router.delete('/cart/:productId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        user.cart.pull(req.params.productId);
        await user.save();
        
        await user.populate('cart');
        res.json(user.cart);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- GET LOGGED-IN USER'S LISTINGS ---
router.get('/me/listings', auth, async (req, res) => {
    try {
        const products = await Product.find({ seller: req.user.id, status: 'for-sale' }).sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// --- GET LOGGED-IN USER'S SOLD HISTORY ---
router.get('/me/sold', auth, async (req, res) => {
    try {
        const products = await Product.find({ seller: req.user.id, status: 'sold' })
            .populate('buyer', 'name')
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// --- GET LOGGED-IN USER'S PURCHASE HISTORY ---
router.get('/me/purchased', auth, async (req, res) => {
    try {
        const products = await Product.find({ buyer: req.user.id, status: 'sold' })
            .populate('seller', 'name')
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// --- GET SELLER PROFILE AND PRODUCTS ---
router.get('/:userId/products', async (req, res) => {
  try {
    // Find the seller by their ID to get their name
    const seller = await User.findById(req.params.userId).select('name');
    if (!seller) {
      return res.status(404).json({ msg: 'Seller not found' });
    }

    // Find all products listed by that seller that are still for sale
    const products = await Product.find({ seller: req.params.userId, status: 'for-sale' })
        .populate('seller', 'name') // Keep populating for consistency on the product card
        .sort({ createdAt: -1 });

    // Return both the seller's info and their products
    res.json({ seller, products });

  } catch (err) {
    console.error(err.message);
    // Handle potential invalid ObjectId errors
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Seller not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;