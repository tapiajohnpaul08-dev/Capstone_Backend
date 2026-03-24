const express = require('express');
const router = express.Router();
const RawMaterialController = require('../controller/RawMaterialController');
const { verifyAdminToken, checkRole } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// ALL ROUTES — ADMIN PROTECTED
// ─────────────────────────────────────────

// NOTE: static paths before dynamic /:materialId
router.get('/low-stock', verifyAdminToken, RawMaterialController.getLowStockMaterials);
router.get('/category/:category', verifyAdminToken, RawMaterialController.getRawMaterialsByCategory);

router.get('/', verifyAdminToken, RawMaterialController.getAllRawMaterials);
router.get('/:materialId', verifyAdminToken, RawMaterialController.getRawMaterialById);
router.post('/', verifyAdminToken, checkRole('Production'), RawMaterialController.createRawMaterial);
router.put('/:materialId', verifyAdminToken, checkRole('Production'), RawMaterialController.updateRawMaterial);
router.patch('/:materialId/add', verifyAdminToken, checkRole('Production'), RawMaterialController.addStock);
router.patch('/:materialId/deduct', verifyAdminToken, checkRole('Production'), RawMaterialController.deductStock);
router.delete('/:materialId', verifyAdminToken, checkRole('Production'), RawMaterialController.deleteRawMaterial);

module.exports = router;