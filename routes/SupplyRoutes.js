// routes/SupplyRoutes.js
const express = require('express');
const router = express.Router();
const SupplyController = require('../controller/SupplyController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────
router.get('/', SupplyController.getAllSupplies);
router.get('/active', SupplyController.getActiveSupplies);
router.get('/category/:category', SupplyController.getSuppliesByCategory);
router.get('/:supplyId', SupplyController.getSupplyById);

// ─────────────────────────────────────────
// ADMIN ONLY ROUTES
// ─────────────────────────────────────────
router.post('/', verifyAdminToken, SupplyController.createSupply);
router.put('/:supplyId', verifyAdminToken, SupplyController.updateSupply);
router.delete('/:supplyId', verifyAdminToken, SupplyController.deleteSupply);

module.exports = router;