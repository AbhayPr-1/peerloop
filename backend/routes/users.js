// backend/routes/users.js (NEW FILE)

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

    // Check if the product is already in the cart
    if (user.cart.includes(product._id)) {
      return res.status(400).json({ msg: 'Product already in cart' });
    }

    user.cart.push(product._id);
    await user.save();
    
    // Populate the cart to return the full product details
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

        // Pull the product ID from the cart array
        user.cart.pull(req.params.productId);
        await user.save();
        
        await user.populate('cart');
        res.json(user.cart);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;