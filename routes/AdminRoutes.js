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
// ADMIN MANAGEMENT ROUTES (admin manages admins)
// ─────────────────────────────────────────
router.get('/allAdmins',          verifyAdminToken, AdminController.getAllAdmins); 
router.get('/admin/:adminId',     verifyAdminToken, AdminController.getAdminById); 
router.put('/admin/:adminId',     verifyAdminToken, AdminController.updateAdmin);

router.delete('/admin/:adminId',  verifyAdminToken, checkRole('Sales'), AdminController.deleteAdmin);

// ─────────────────────────────────────────
// CUSTOMER MANAGEMENT ROUTES (admin manages customers)
// ─────────────────────────────────────────
router.get('/allCustomers',               verifyAdminToken, AdminController.getAllCustomers);
router.get('/customer/:customerId',       verifyAdminToken, AdminController.getCustomerById);
router.delete('/customer/:customerId',    verifyAdminToken, AdminController.deleteCustomer);

module.exports = router;