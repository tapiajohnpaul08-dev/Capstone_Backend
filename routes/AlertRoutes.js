// routes/AlertRoutes.js
const express = require('express');
const router = express.Router();
const AlertController = require('../controller/AlertController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// Apply admin authentication to all alert routes
router.use(verifyAdminToken);

// Send alert for specific item
router.post('/item', AlertController.sendItemAlert);

// Send alert for product size
router.post('/product-size', AlertController.sendProductSizeAlert);

// Scan all inventory and send alerts for low/out of stock items
router.post('/scan-all', AlertController.scanAndAlertAll);

// Send summary report of all problematic items
router.post('/summary', AlertController.sendSummaryReport);

module.exports = router;