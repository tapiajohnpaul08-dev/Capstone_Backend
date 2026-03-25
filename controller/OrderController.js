// controllers/OrderController.js
const orderService = require('../services/OrderServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class OrderController {
    
    createOrder = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 createOrder called');
        
        let user = null;
        let userType = null;
        
        if (req.customer) {
            user = req.customer;
            userType = 'customer';
            console.log('Customer order:', user.email);
        } else if (req.admin) {
            user = req.admin;
            userType = 'admin';
            console.log('Admin order:', user.email);
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

    getMyOrders = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 getMyOrders called');
        const userId = req.customer._id.toString();
        const response = await orderService.getOrdersByOrderedBy(userId);
        res.status(200).json(response);
    });

    getMyOrderById = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 getMyOrderById called');
        const { orderId } = req.params;
        const userId = req.customer._id.toString();
        
        const response = await orderService.getOrderById(orderId);
        
        if (!response.success) {
            return res.status(404).json(response);
        }
        
        if (response.data.orderedBy !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This order does not belong to you.'
            });
        }
        
        res.status(200).json(response);
    });

    updateMyOrder = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 updateMyOrder called');
        const { orderId } = req.params;
        const userId = req.customer._id.toString();
        
        const order = await orderService.getOrderById(orderId);
        
        if (!order.success) {
            return res.status(404).json(order);
        }
        
        if (order.data.orderedBy !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This order does not belong to you.'
            });
        }
        
        if (order.data.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot modify order in ${order.data.status} status. Only pending orders can be modified.`
            });
        }
        
        const response = await orderService.updateOrder(orderId, req.body, req.customer);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    cancelMyOrder = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 cancelMyOrder called');
        const { orderId } = req.params;
        const userId = req.customer._id.toString();
        
        const order = await orderService.getOrderById(orderId);
        
        if (!order.success) {
            return res.status(404).json(order);
        }
        
        if (order.data.orderedBy !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This order does not belong to you.'
            });
        }
        
        const cancellableStatuses = ['Pending', 'Scheduled'];
        if (!cancellableStatuses.includes(order.data.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel order in ${order.data.status} status. Only pending or scheduled orders can be cancelled.`
            });
        }
        
        const response = await orderService.updateOrderStatus(orderId, 'Cancelled', 'Cancelled by customer', req.customer);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    getAllOrders = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 getAllOrders called');
        const filters = req.query;
        const response = await orderService.getAllOrders(filters);
        res.status(200).json(response);
    });

    getOrderById = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 getOrderById called');
        const { orderId } = req.params;
        const response = await orderService.getOrderById(orderId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    updateOrderStatus = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 updateOrderStatus called');
        const { orderId } = req.params;
        const { status, notes } = req.body;
        const user = req.admin;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }
        
        const response = await orderService.updateOrderStatus(orderId, status, notes, user);
        const statusCode = response.success ? 200 : 400;
        res.status(statusCode).json(response);
    });

    updatePaymentStatus = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 updatePaymentStatus called');
        const { orderId } = req.params;
        const { paymentStatus, amountPaid } = req.body;
        const user = req.admin;
        
        if (!paymentStatus) {
            return res.status(400).json({
                success: false,
                message: 'Payment status is required'
            });
        }
        
        const response = await orderService.updatePaymentStatus(orderId, paymentStatus, amountPaid, user);
        const statusCode = response.success ? 200 : 400;
        res.status(statusCode).json(response);
    });

    updateOrder = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 updateOrder called');
        const { orderId } = req.params;
        const user = req.admin;
        const response = await orderService.updateOrder(orderId, req.body, user);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    deleteOrder = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 deleteOrder called');
        const { orderId } = req.params;
        const response = await orderService.deleteOrder(orderId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    getOrderStatistics = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 getOrderStatistics called');
        const response = await orderService.getOrderStatistics();
        res.status(200).json(response);
    });

    getOrdersByDateRange = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 getOrdersByDateRange called');
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

    getOrdersByCustomer = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 getOrdersByCustomer called');
        const { email } = req.params;
        const response = await orderService.getOrdersByCustomerEmail(email);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    getOrderByIdShared = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 getOrderByIdShared called');
        const { orderId } = req.params;
        const response = await orderService.getOrderById(orderId);
        
        if (!response.success) {
            return res.status(404).json(response);
        }
        
        if (req.customer && response.data.orderedBy !== req.customer._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. This order does not belong to you.'
            });
        }
        
        res.status(200).json(response);
    });

    getMyOrdersShared = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 getMyOrdersShared called');
        let customerEmail;
        
        if (req.customer) {
            customerEmail = req.customer.email;
        } else if (req.admin) {
            customerEmail = req.query.email;
            if (!customerEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer email is required for admin access'
                });
            }
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        const response = await orderService.getOrdersByCustomerEmail(customerEmail);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });
}

module.exports = new OrderController();