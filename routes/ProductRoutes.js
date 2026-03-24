const express = require('express');
const router = express.Router();
const ProductController = require('../controller/ProductController');
const { verifyAdminToken, verifyAnyToken } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// PUBLIC ROUTES (customers can browse)
// ─────────────────────────────────────────
router.get('/',                          ProductController.getAllProducts);
router.get('/category/:category',        ProductController.getProductsByCategory);
router.get('/:productId',                ProductController.getProductById);
router.get('/:productId/price',          ProductController.getPrice);

// ─────────────────────────────────────────
// ADMIN PROTECTED ROUTES
// ─────────────────────────────────────────
router.post('/',            verifyAdminToken, ProductController.createProduct);
router.put('/:productId',                verifyAdminToken, ProductController.updateProduct);
router.put('/:productId/size',           verifyAdminToken, ProductController.updateSizePrice);
router.delete('/:productId',             verifyAdminToken, ProductController.deleteProduct);

module.exports = router;