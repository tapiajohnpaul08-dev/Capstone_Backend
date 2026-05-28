// routes/CustomerRoutes.js
const express = require('express');
const router = express.Router();
const CustomerController = require('../controller/CustomerController');
const CustomerTemplateController = require('../controller/CustomerTemplateContoller');
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

// ─────────────────────────────────────────
// CUSTOMER TEMPLATE ROUTES
// ─────────────────────────────────────────
router.get('/templates', verifyCustomerToken, CustomerTemplateController.getTemplates);
router.get('/templates/:templateId', verifyCustomerToken, CustomerTemplateController.getTemplateById);
router.post('/templates', verifyCustomerToken, CustomerTemplateController.createTemplate);
router.put('/templates/:templateId', verifyCustomerToken, CustomerTemplateController.updateTemplate);
router.delete('/templates/:templateId', verifyCustomerToken, CustomerTemplateController.deleteTemplate);
router.post('/templates/save-from-order', verifyCustomerToken, CustomerTemplateController.saveDesignAsTemplate);

module.exports = router;