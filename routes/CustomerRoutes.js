const express = require('express');
const router = express.Router();
const CustomerController = require('../controller/CustomerController');
const { verifyCustomerToken, verifyAdminToken } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────
router.post('/register', CustomerController.register);
router.post('/login',    CustomerController.login);
router.get('/verify',    CustomerController.verifyToken);

// ─────────────────────────────────────────
// CUSTOMER PROTECTED ROUTES
// ─────────────────────────────────────────
router.post('/logout', verifyCustomerToken, CustomerController.logout);
router.get('/profile', verifyCustomerToken, CustomerController.getProfile);
router.put('/:customerId',          verifyCustomerToken, CustomerController.updateCustomer);
router.put('/:customerId/password', verifyCustomerToken, CustomerController.changePassword);



module.exports = router;