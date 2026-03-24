// controllers/OrderController.js
const orderService = require('../services/OrderServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class OrderController {
    
    // ─────────────────────────────────────────
    // CREATE ORDER (with auth)
    // ─────────────────────────────────────────
    createOrder = asyncTryCatch(async (req, res, next) => {
        let user = null;
        let userType = null;
        
        if (req.customer) {
            user = req.customer;
            userType = 'customer';
        } else if (req.admin) {
            user = req.admin;
            userType = 'admin';
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
                
        const response = await orderService.createOrder(req.body, user, userType);
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // ─────────────────────────────────────────
    // GET MY ORDERS (customer)
    // ─────────────────────────────────────────
    getMyOrders = asyncTryCatch(async (req, res, next) => {
        const response = await orderService.getOrdersByOrderedBy(
            req.customer._id, 
            'Customer'
        );
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // ─────────────────────────────────────────
    // GET MY ORDER BY ID (customer)
    // ─────────────────────────────────────────
    getMyOrderById = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const customerId = req.customer._id;
        
        const response = await orderService.getOrderById(orderId);
        
        if (!response.success) {
            return res.status(404).json(response);
        }
        
        // Verify order belongs to this customer
        if (response.data.orderedBy.toString() !== customerId.toString() || 
            response.data.orderedByModel !== 'Customer') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This order does not belong to you.'
            });
        }
        
        res.status(200).json(response);
    });

    // ─────────────────────────────────────────
    // UPDATE MY ORDER (customer)
    // ─────────────────────────────────────────
    updateMyOrder = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const customerId = req.customer._id;
        
        // First, verify order belongs to customer
        const order = await orderService.getOrderById(orderId);
        
        if (!order.success) {
            return res.status(404).json(order);
        }
        
        if (order.data.orderedBy.toString() !== customerId.toString() || 
            order.data.orderedByModel !== 'Customer') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This order does not belong to you.'
            });
        }
        
        // Check if order can be modified (only Pending orders can be modified by customer)
        if (order.data.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot modify order in ${order.data.status} status. Only pending orders can be modified.`
            });
        }
        
        const response = await orderService.updateOrder(
            orderId, 
            req.body, 
            req.customer, 
            'Customer'
        );
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // ─────────────────────────────────────────
    // CANCEL MY ORDER (customer)
    // ─────────────────────────────────────────
    cancelMyOrder = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const customerId = req.customer._id;
        
        // Verify order belongs to customer
        const order = await orderService.getOrderById(orderId);
        
        if (!order.success) {
            return res.status(404).json(order);
        }
        
        if (order.data.orderedBy.toString() !== customerId.toString() || 
            order.data.orderedByModel !== 'Customer') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This order does not belong to you.'
            });
        }
        
        // Check if order can be cancelled
        const cancellableStatuses = ['Pending', 'Scheduled'];
        if (!cancellableStatuses.includes(order.data.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel order in ${order.data.status} status. Only pending or scheduled orders can be cancelled.`
            });
        }
        
        const response = await orderService.updateOrderStatus(
            orderId, 
            'Cancelled', 
            'Cancelled by customer', 
            req.customer, 
            'Customer'
        );
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // ─────────────────────────────────────────
    // GET ALL ORDERS (admin only)
    // ─────────────────────────────────────────
    getAllOrders = asyncTryCatch(async (req, res, next) => {
        const { status, paymentStatus, receivingMode, customerEmail, productId, startDate, endDate, orderedBy, orderedByModel } = req.query;
        
        const filters = {
            status,
            paymentStatus,
            receivingMode,
            customerEmail,
            productId,
            startDate,
            endDate,
            orderedBy,
            orderedByModel
        };
        
        // Remove undefined filters
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        
        const response = await orderService.getAllOrders(filters);
        res.status(200).json(response);
    });

    // ─────────────────────────────────────────
    // GET ORDER BY ID (admin only)
    // ─────────────────────────────────────────
    getOrderById = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const response = await orderService.getOrderById(orderId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // ─────────────────────────────────────────
    // GET ORDERS BY CUSTOMER EMAIL (admin only)
    // ─────────────────────────────────────────
    getOrdersByCustomerEmail = asyncTryCatch(async (req, res, next) => {
        const { email } = req.params;
        const response = await orderService.getOrdersByCustomerEmail(email);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // ─────────────────────────────────────────
    // UPDATE ORDER STATUS (admin only)
    // ─────────────────────────────────────────
    updateOrderStatus = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const { status, notes } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }
        
        const response = await orderService.updateOrderStatus(
            orderId, 
            status, 
            notes, 
            req.admin, 
            'Admin'
        );
        const statusCode = response.success ? 200 : 400;
        res.status(statusCode).json(response);
    });

    // ─────────────────────────────────────────
    // UPDATE PAYMENT STATUS (admin only)
    // ─────────────────────────────────────────
    updatePaymentStatus = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const { paymentStatus, amountPaid } = req.body;
        
        if (!paymentStatus) {
            return res.status(400).json({
                success: false,
                message: 'Payment status is required'
            });
        }
        
        const response = await orderService.updatePaymentStatus(
            orderId, 
            paymentStatus, 
            amountPaid, 
            req.admin, 
            'Admin'
        );
        const statusCode = response.success ? 200 : 400;
        res.status(statusCode).json(response);
    });

    // ─────────────────────────────────────────
    // UPDATE ORDER (admin only)
    // ─────────────────────────────────────────
    updateOrder = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const response = await orderService.updateOrder(
            orderId, 
            req.body, 
            req.admin, 
            'Admin'
        );
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // ─────────────────────────────────────────
    // DELETE ORDER (admin only)
    // ─────────────────────────────────────────
    deleteOrder = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const response = await orderService.deleteOrder(orderId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // ─────────────────────────────────────────
    // GET ORDER STATISTICS (admin only)
    // ─────────────────────────────────────────
    getOrderStatistics = asyncTryCatch(async (req, res, next) => {
        const response = await orderService.getOrderStatistics();
        res.status(200).json(response);
    });

    // ─────────────────────────────────────────
    // GET ORDERS BY DATE RANGE (admin only)
    // ─────────────────────────────────────────
    getOrdersByDateRange = asyncTryCatch(async (req, res, next) => {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }
        
        const response = await orderService.getOrdersByDateRange(startDate, endDate);
        res.status(200).json(response);
    });

    // ─────────────────────────────────────────
    // GET ORDERS BY ORDERED BY (admin only)
    // ─────────────────────────────────────────
    getOrdersByOrderedBy = asyncTryCatch(async (req, res, next) => {
        const { orderedById, orderedByModel } = req.params;
        
        if (!orderedById || !orderedByModel) {
            return res.status(400).json({
                success: false,
                message: 'Ordered by ID and model are required'
            });
        }
        
        const response = await orderService.getOrdersByOrderedBy(orderedById, orderedByModel);
        res.status(200).json(response);
    });
}

module.exports = new OrderController();