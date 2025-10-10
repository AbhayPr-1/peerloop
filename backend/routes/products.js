// backend/routes/products.js
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/authMiddleware');

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).send('Server error'); }
});

// Create a new product
router.post('/', auth, async (req, res) => {
  const { name, description, price, category, imageUrl } = req.body;
  try {
    const newProduct = new Product({ name, description, price, category, imageUrl, seller: req.user.id });
    const product = await newProduct.save();
    res.json(product);
  } catch (err) { res.status(500).send('Server Error'); }
});

// Delete a product (Buy)
router.delete('/:id', auth, async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    if (product.seller.toString() === req.user.id) return res.status(400).json({ msg: 'You cannot buy your own product' });
    await product.deleteOne();
    res.json({ msg: 'Product purchased successfully' });
  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;