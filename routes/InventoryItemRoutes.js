const express = require('express');
const router = express.Router();
const InventoryItemController = require('../controller/InventoryItemController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// ALL ROUTES — ADMIN PROTECTED
// ─────────────────────────────────────────

// NOTE: /low-stock must be defined before /:inventoryId
// otherwise Express will treat "low-stock" as an inventoryId param
router.get('/low-stock',                   verifyAdminToken, InventoryItemController.getLowStockItems);
router.get('/product/:productId',          verifyAdminToken, InventoryItemController.getInventoryByProduct);

router.get('/',                            verifyAdminToken, InventoryItemController.getAllInventoryItems);
router.get('/:inventoryId',                verifyAdminToken, InventoryItemController.getInventoryItemById);
router.post('/',                           verifyAdminToken, InventoryItemController.createInventoryItem);
router.put('/:inventoryId',                verifyAdminToken, InventoryItemController.updateInventoryItem);
router.patch('/:inventoryId/add',          verifyAdminToken, InventoryItemController.addStock);
router.patch('/:inventoryId/deduct',       verifyAdminToken, InventoryItemController.deductStock);
router.delete('/:inventoryId',             verifyAdminToken, InventoryItemController.deleteInventoryItem);

module.exports = router;