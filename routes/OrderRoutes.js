// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controller/OrderController');
const {
    verifyAdminToken,
    verifyCustomerToken,
    checkRole
} = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// CUSTOMER ROUTES (require customer authentication)
// ─────────────────────────────────────────
router.use('/customer', verifyCustomerToken);

router.post('/customer/create', orderController.createOrder);
router.get('/customer/my-orders', orderController.getMyOrders);
router.get('/customer/orders/:orderId', orderController.getMyOrderById);
router.put('/customer/orders/:orderId', orderController.updateMyOrder);
router.patch('/customer/orders/:orderId/cancel', orderController.cancelMyOrder);
router.patch('/customer/orders/:orderId/mark-received', orderController.toggleReceivedStatus);
// ─────────────────────────────────────────
// ADMIN ROUTES (require admin authentication)
// ─────────────────────────────────────────
router.use('/admin', verifyAdminToken);

router.post('/admin/create', orderController.createOrder);
router.get('/admin/all', orderController.getAllOrders);
router.get('/admin/statistics', orderController.getOrderStatistics);
router.get('/admin/date-range', orderController.getOrdersByDateRange);
router.get('/admin/customers/:email/orders', orderController.getOrdersByCustomer);
router.get('/admin/orders/:orderId', orderController.getOrderById);
router.put('/admin/orders/:orderId', orderController.updateOrder);
router.patch('/admin/orders/:orderId/status', orderController.updateOrderStatus);
router.patch('/admin/orders/:orderId/payment', orderController.updatePaymentStatus);
router.delete('/admin/orders/:orderId', orderController.deleteOrder);

module.exports = router;