// controller/OrderController.js
const orderService = require('../services/OrderServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class OrderController {

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
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const response = await orderService.createOrder(req.body, user, userType);
        res.status(response.success ? 201 : 400).json(response);
    });

    getMyOrders = asyncTryCatch(async (req, res, next) => {
        const userId = req.customer._id.toString();
        const response = await orderService.getOrdersByOrderedBy(userId);
        res.status(200).json(response);
    });

    getMyOrderById = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const userId = req.customer._id.toString();
        const response = await orderService.getOrderById(orderId);
        if (!response.success) return res.status(404).json(response);
        if (response.data.orderedBy !== userId) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        res.status(200).json(response);
    });

    updateMyOrder = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const userId = req.customer._id.toString();
        const order = await orderService.getOrderById(orderId);
        if (!order.success) return res.status(404).json(order);
        if (order.data.orderedBy !== userId) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        if (order.data.status !== 'Pending') {
            return res.status(400).json({ success: false, message: `Cannot modify order in ${order.data.status} status.` });
        }
        const response = await orderService.updateOrder(orderId, req.body, req.customer);
        res.status(response.success ? 200 : 400).json(response);
    });

    cancelMyOrder = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const userId = req.customer._id.toString();
        const order = await orderService.getOrderById(orderId);
        if (!order.success) return res.status(404).json(order);
        if (order.data.orderedBy !== userId) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        const cancellableStatuses = ['Pending', 'Scheduled'];
        if (!cancellableStatuses.includes(order.data.status)) {
            return res.status(400).json({ success: false, message: `Cannot cancel order in ${order.data.status} status.` });
        }
        const response = await orderService.updateOrderStatus(orderId, 'Cancelled', 'Cancelled by customer', req.customer);
        res.status(response.success ? 200 : 400).json(response);
    });

    getAllOrders = asyncTryCatch(async (req, res, next) => {
        const response = await orderService.getAllOrders(req.query);
        res.status(200).json(response);
    });

    getOrderById = asyncTryCatch(async (req, res, next) => {
        const response = await orderService.getOrderById(req.params.orderId);
        res.status(response.success ? 200 : 404).json(response);
    });

    // ─────────────────────────────────────────
    // UPDATE ORDER STATUS (admin)
    // Forwards `codCollected` so OrderServices can decide whether to
    // auto-mark Partial → Paid when the order is completed.
    // ─────────────────────────────────────────
    updateOrderStatus = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const { status, notes, productionSchedule, driverId, codCollected } = req.body;
        const user = req.admin;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        const response = await orderService.updateOrderStatus(
            orderId,
            status,
            notes,
            productionSchedule,
            driverId,
            user,
            {
                codCollected:
                    codCollected === true ||
                    codCollected === 'true' ||
                    codCollected === '1',
            }
        );

        // Emit real-time status update to the linked conversation (if any)
        if (response.success) {
            try {
                const io = req.app.get('io');
                if (io) {
                    const Conversation = require('../models/Conversation.Model');
                    const conv = await Conversation.findOne({ orderId });
                    if (conv) {
                        io.to(`conv_${conv.conversationId}`).emit('order-negotiation-updated', response.data);
                    }
                }
            } catch (e) {
                console.error('Emit order status update error:', e);
            }
        }

        res.status(response.success ? 200 : 400).json(response);
    });

    updatePaymentStatus = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const { paymentStatus, amountPaid, partialPayments } = req.body;
        const user = req.admin;

        if (!paymentStatus) {
            return res.status(400).json({ success: false, message: 'Payment status is required' });
        }

        const response = await orderService.updatePaymentStatus(
            orderId, paymentStatus, amountPaid, user, partialPayments
        );
        res.status(response.success ? 200 : 400).json(response);
    });

    updateOrder = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const user = req.admin;
        const response = await orderService.updateOrder(orderId, req.body, user);
        res.status(response.success ? 200 : 400).json(response);
    });

    deleteOrder = asyncTryCatch(async (req, res, next) => {
        const response = await orderService.deleteOrder(req.params.orderId);
        res.status(response.success ? 200 : 404).json(response);
    });

    getOrderStatistics = asyncTryCatch(async (req, res, next) => {
        const response = await orderService.getOrderStatistics();
        res.status(200).json(response);
    });

    getOrdersByDateRange = asyncTryCatch(async (req, res, next) => {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Start date and end date are required' });
        }
        const response = await orderService.getOrdersByDateRange(startDate, endDate);
        res.status(200).json(response);
    });

    getOrdersByCustomer = asyncTryCatch(async (req, res, next) => {
        const response = await orderService.getOrdersByCustomerEmail(req.params.email);
        res.status(response.success ? 200 : 404).json(response);
    });

    getOrderByIdShared = asyncTryCatch(async (req, res, next) => {
        const response = await orderService.getOrderById(req.params.orderId);
        if (!response.success) return res.status(404).json(response);
        if (req.customer && response.data.orderedBy !== req.customer._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }
        res.status(200).json(response);
    });

    getMyOrdersShared = asyncTryCatch(async (req, res, next) => {
        let customerEmail;
        if (req.customer) {
            customerEmail = req.customer.email;
        } else if (req.admin) {
            customerEmail = req.query.email;
            if (!customerEmail) {
                return res.status(400).json({ success: false, message: 'Customer email is required for admin access' });
            }
        } else {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const response = await orderService.getOrdersByCustomerEmail(customerEmail);
        res.status(response.success ? 200 : 404).json(response);
    });

    toggleReceivedStatus = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const { isReceived } = req.body;
        const user = req.customer;
        const response = await orderService.toggleReceivedStatus(orderId, isReceived, user);
        res.status(response.success ? 200 : 400).json(response);
    });

    // ─────────────────────────────────────────
    // NEGOTIATE ORDER — edit pricing fields during Pending status
    // ─────────────────────────────────────────
    negotiateOrder = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const user = req.admin;

        const response = await orderService.negotiateOrder(orderId, req.body, user);

        if (response.success) {
            try {
                const io = req.app.get('io');
                if (io) {
                    const Conversation = require('../models/Conversation.Model');
                    const conv = await Conversation.findOne({ orderId });
                    if (conv) {
                        io.to(`conv_${conv.conversationId}`).emit('order-negotiation-updated', response.data);
                        console.log(`📤 Emitted order-negotiation-updated to conv_${conv.conversationId}`);
                    } else {
                        console.warn(`⚠️ No conversation found for orderId ${orderId}`);
                    }
                }
            } catch (e) {
                console.error('Emit negotiateOrder error:', e);
            }
        }

        res.status(response.success ? 200 : 400).json(response);
    });

    // ─────────────────────────────────────────
    // POST /order/admin/orders/:id/confirm-with-downpayment
    // ─────────────────────────────────────────
    confirmWithDownpayment = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const { amountPaid, method, referenceNumber, proofUrl, isFullPayment, paymentRequestMessageId } = req.body;
        const user = req.admin;

        if (!amountPaid || Number(amountPaid) <= 0) {
            return res.status(400).json({ success: false, message: 'amountPaid is required and must be > 0' });
        }

        const response = await orderService.confirmWithDownpayment(
            orderId,
            {
                amountPaid: Number(amountPaid),
                method: method || '',
                referenceNumber: referenceNumber || '',
                proofUrl: proofUrl || '',
                isFullPayment: !!isFullPayment,
                paymentRequestMessageId: paymentRequestMessageId || null,
            },
            user
        );

        if (response.success) {
            try {
                const io = req.app.get('io');
                if (io) {
                    const Conversation = require('../models/Conversation.Model');
                    const conv = await Conversation.findOne({ orderId });
                    if (conv) {
                        io.to(`conv_${conv.conversationId}`).emit('order-negotiation-updated', response.data);
                    }
                }
            } catch (e) {
                console.error('Emit confirm error:', e);
            }
        }

        res.status(response.success ? 200 : 400).json(response);
    });
}

module.exports = new OrderController();