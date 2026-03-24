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
router.put('/:customerId',          verifyCustomerToken, CustomerController.updateCustomer);
router.put('/:customerId/password', verifyCustomerToken, CustomerController.changePassword);

// ─────────────────────────────────────────
// ADMIN PROTECTED ROUTES (admin manages customers)
// ─────────────────────────────────────────
router.get('/',               verifyAdminToken, CustomerController.getAllCustomers);
router.get('/:customerId',    verifyAdminToken, CustomerController.getCustomerById);
router.delete('/:customerId', verifyAdminToken, CustomerController.deleteCustomer);

module.exports = router;