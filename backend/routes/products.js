// backend/routes/products.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator'); // Import validator functions
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// Get all products (that are for sale)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ status: 'for-sale' })
        .populate('seller', 'name')
        .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).send('Server error'); }
});

// Create a new product
router.post('/', [
  auth,
  // --- VALIDATION RULES ---
  body('name', 'Product name is required').not().isEmpty().trim().escape(),
  body('description', 'Description is required').not().isEmpty().trim().escape(),
  body('price', 'Price must be a positive number').isFloat({ gt: 0 }),
  body('category', 'A valid category is required').isIn(['electronics', 'wearables', 'cybernetics', 'data']),
  body('imageUrl', 'Image is required').not().isEmpty()
], async (req, res) => {
  // --- VALIDATION CHECK ---
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, price, category, imageUrl } = req.body;
  try {
    const newProduct = new Product({ name, description, price, category, imageUrl, seller: req.user.id });
    const product = await newProduct.save();
    res.json(product);
  } catch (err) { res.status(500).send('Server Error'); }
});

// "BUY" ROUTE
router.post('/:id/buy', auth, async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    if (product.seller.toString() === req.user.id) return res.status(400).json({ msg: 'You cannot buy your own product' });
    if (product.status === 'sold') return res.status(400).json({ msg: 'This product has already been sold' });

    product.status = 'sold';
    product.buyer = req.user.id;
    await product.save();

    await User.updateMany(
        { cart: req.params.id },
        { $pull: { cart: req.params.id } }
    );

    res.json({ msg: 'Product purchased successfully', product });
  } catch (err) { 
    console.error(err.message);
    res.status(500).send('Server Error'); 
  }
});

module.exports = router;