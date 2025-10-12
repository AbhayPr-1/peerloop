// backend/routes/products.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose'); // Import mongoose for transactions
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ status: 'for-sale' })
        .populate('seller', 'name')
        .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Create a new product
router.post('/', [
  auth,
  body('name', 'Product name is required').not().isEmpty().trim().escape(),
  body('description', 'Description is required').not().isEmpty().trim().escape(),
  body('price', 'Price must be a positive number').isFloat({ gt: 0 }),
  body('category', 'A valid category is required').isIn(['electronics', 'wearables', 'cybernetics', 'data']),
  body('imageUrl', 'Image is required').not().isEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, price, category, imageUrl } = req.body;
  try {
    const newProduct = new Product({ name, description, price, category, imageUrl, seller: req.user.id });
    const product = await newProduct.save();
    res.json(product);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// "BUY" ROUTE - UPDATED WITH ATOMIC TRANSACTION
router.post('/:id/buy', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const product = await Product.findById(req.params.id).session(session);
    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ msg: 'Product not found' });
    }
    if (product.seller.toString() === req.user.id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ msg: 'You cannot buy your own product' });
    }
    if (product.status === 'sold') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ msg: 'This product has already been sold' });
    }

    product.status = 'sold';
    product.buyer = req.user.id;
    await product.save({ session });

    // Remove the product from any user's cart
    await User.updateMany({ cart: req.params.id }, { $pull: { cart: req.params.id } }).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({ msg: 'Product purchased successfully', product });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Transaction Error:", err.message); // Enhanced logging
    res.status(500).send('Server Error');
  }
});

module.exports = router;