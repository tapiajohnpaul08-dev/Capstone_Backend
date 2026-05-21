// routes/InventoryItemRoutes.js
const express = require('express');
const router = express.Router();
const InventoryController = require('../controller/InventoryItemController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// ADMIN ONLY ROUTES
// ─────────────────────────────────────────
router.get('/', verifyAdminToken, InventoryController.getAllInventory);
router.get('/type/:type', verifyAdminToken, InventoryController.getInventoryByType);
router.get('/low-stock', verifyAdminToken, InventoryController.getLowStockItems);
router.get('/out-of-stock', verifyAdminToken, InventoryController.getOutOfStockItems);
router.get('/statistics', verifyAdminToken, InventoryController.getStatistics);
router.get('/:itemId', verifyAdminToken, InventoryController.getInventoryById);

router.post('/products/:productId', verifyAdminToken, InventoryController.addProductToInventory);
router.post('/supplies/:supplyId', verifyAdminToken, InventoryController.addSupplyToInventory);
router.put('/:itemId', verifyAdminToken, InventoryController.updateInventoryItem);
router.patch('/:itemId/stock', verifyAdminToken, InventoryController.updateStock);
router.delete('/:itemId', verifyAdminToken, InventoryController.deleteInventoryItem);

module.exports = router;