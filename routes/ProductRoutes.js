const express = require('express');
const router = express.Router();
const ProductController = require('../controller/ProductController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// PUBLIC ROUTES (customer can view)
// ─────────────────────────────────────────
router.get('/', ProductController.getAllProducts);
router.get('/featured', ProductController.getFeaturedProducts);
router.get('/popular', ProductController.getPopularProducts);
router.get('/category/:category', ProductController.getProductsByCategory);
router.get('/:id', ProductController.getProductById);
router.get('/:id/sizes', ProductController.getAllSizes);
router.get('/:id/size/:sizeName', ProductController.getSizeDetails);
router.post('/calculate-price', ProductController.calculatePrice);

// ─────────────────────────────────────────
// ADMIN ONLY ROUTES (product management)
// ─────────────────────────────────────────
router.post('/create', verifyAdminToken, ProductController.createProduct);
router.put('/update/:id', verifyAdminToken, ProductController.updateProduct);
router.delete('/delete/:id', verifyAdminToken, ProductController.deleteProduct);
router.patch('/update-stock/:id', verifyAdminToken, ProductController.updateStockStatus);

// ─────────────────────────────────────────
// ADMIN ONLY ROUTES (size management)
// ─────────────────────────────────────────
router.post('/:id/size', verifyAdminToken, ProductController.addSize);
router.put('/:id/size/:sizeName', verifyAdminToken, ProductController.updateSize);
router.delete('/:id/size/:sizeName', verifyAdminToken, ProductController.removeSize);
router.patch('/:id/size/:sizeName/bulk-prices', verifyAdminToken, ProductController.updateBulkPrices);


// Stock management for sizes
router.patch('/:id/size/:sizeName/stock', verifyAdminToken, ProductController.updateSizeStock);
router.post('/:id/size/:sizeName/reduce-stock', verifyAdminToken, ProductController.reduceStock);

module.exports = router;