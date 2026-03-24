const express = require('express');
const router = express.Router();
const AdminController = require('../controller/AdminController');
const { verifyAdminToken, checkRole } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// PUBLIC ROUTES (no token required)
// ─────────────────────────────────────────
router.post('/register', AdminController.createAdmin);
router.post('/login',    AdminController.login);
router.get('/verify',    AdminController.verifyToken);

// ─────────────────────────────────────────
// PROTECTED ROUTES (token required)
// ─────────────────────────────────────────
router.get('/',          verifyAdminToken, AdminController.getAllAdmins);
router.get('/:adminId',  verifyAdminToken, AdminController.getAdminById);
router.put('/:adminId',  verifyAdminToken, AdminController.updateAdmin);
router.delete('/:adminId', verifyAdminToken, checkRole('Sales'), AdminController.deleteAdmin);

module.exports = router;