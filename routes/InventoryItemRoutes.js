const express = require('express');
const router = express.Router();
const InventoryController = require('../controller/InventoryItemController');
const { verifyAdminToken } = require('../middleware/authMiddleware');
const { chatUpload } = require('../config/multer');

// ─────────────────────────────────────────
// LITERAL ROUTES (must come before /:itemId)
// ─────────────────────────────────────────
router.get('/',                    verifyAdminToken, InventoryController.getAllInventory);
router.get('/type/:type',          verifyAdminToken, InventoryController.getInventoryByType);
router.get('/low-stock',           verifyAdminToken, InventoryController.getLowStockItems);
router.get('/out-of-stock',        verifyAdminToken, InventoryController.getOutOfStockItems);
router.get('/statistics',          verifyAdminToken, InventoryController.getStatistics);

// Movement image upload (admin-authenticated, multipart)
router.post(
  '/upload-movement-image',
  verifyAdminToken,
  chatUpload.single('image'),
  InventoryController.uploadMovementImage,
);

// ─────────────────────────────────────────
// PARAMETERIZED ROUTES
// ─────────────────────────────────────────
router.get('/:itemId',             verifyAdminToken, InventoryController.getInventoryById);
router.get('/:itemId/movements',   verifyAdminToken, InventoryController.getMovementHistory);
router.patch('/:itemId/movement',  verifyAdminToken, InventoryController.recordStockMovement);

router.post('/products/:productId', verifyAdminToken, InventoryController.addProductToInventory);
router.post('/supplies/:supplyId',  verifyAdminToken, InventoryController.addSupplyToInventory);
router.put('/:itemId',              verifyAdminToken, InventoryController.updateInventoryItem);
router.patch('/:itemId/stock',      verifyAdminToken, InventoryController.updateStock);
router.delete('/:itemId',           verifyAdminToken, InventoryController.deleteInventoryItem);

module.exports = router;