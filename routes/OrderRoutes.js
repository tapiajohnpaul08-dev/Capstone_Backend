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

// Customer creates their own order
router.post('/customer/create', orderController.createOrder);

// Customer views their own orders
router.get('/customer/my-orders', orderController.getMyOrders);

// Customer views specific order
router.get('/customer/orders/:orderId', orderController.getMyOrderById);

// Customer updates their own order (before processing)
router.put('/customer/orders/:orderId', orderController.updateMyOrder);

// Customer cancels their own order
router.patch('/customer/orders/:orderId/cancel', orderController.cancelMyOrder);

// ─────────────────────────────────────────
// ADMIN ROUTES (require admin authentication)
// ─────────────────────────────────────────
router.use('/admin', verifyAdminToken);

// Full access for admins
router.post('/admin/create', orderController.createOrder);
router.get('/admin/all', orderController.getAllOrders);
router.get('/admin/statistics', orderController.getOrderStatistics);
router.get('/admin/date-range', orderController.getOrdersByDateRange);
router.get('/admin/orders/:orderId', orderController.getOrderById);
router.put('/admin/orders/:orderId', orderController.updateOrder);
router.delete('/admin/orders/:orderId', orderController.deleteOrder);

// Status management (requires specific roles)
router.patch('/admin/orders/:orderId/status', 
    checkRole('admin', 'production_manager'), 
    orderController.updateOrderStatus
);

router.patch('/admin/orders/:orderId/payment', 
    checkRole('admin', 'sales_manager'), 
    orderController.updatePaymentStatus
);

// Customer management for admins
router.get('/admin/customers/:email/orders', 
    checkRole('admin', 'sales_manager'), 
    orderController.getOrdersByCustomerEmail
);

// Get orders by orderedBy (who placed the order)
router.get('/admin/ordered-by/:orderedById/:orderedByModel', 
    checkRole('admin'), 
    orderController.getOrdersByOrderedBy
);

module.exports = router;