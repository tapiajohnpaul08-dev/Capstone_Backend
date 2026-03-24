// services/OrderService.js
const Order = require('../models/Order.Model');
const InventoryItem = require('../models/InventoryItem.Model');
const Product = require('../models/Product.Model');
const Admin = require('../models/Admin.Model');
const Customer = require('../models/Customer.Model');
const generateId = require('../utils/generateId');

class OrderService {
    
    // services/OrderService.js (updated createOrder method)

async createOrder(payload, user = null, userType = null) {
    try {
        // Validate product exists
        const product = await Product.findOne({ productId: payload.productId });
        if (!product) {
            return { success: false, message: 'Product not found' };
        }

        // Validate size exists on product (case-insensitive)
        const sizeExists = product.sizes.some(
            s => s.label.toLowerCase() === payload.size.toLowerCase()
        );
        if (!sizeExists) {
            return {
                success: false,
                message: `Size "${payload.size}" does not exist for this product. Available sizes: ${product.sizes.map(s => s.label).join(', ')}`
            };
        }

        const prId = product._id.toString();

        // Find inventory with case-insensitive size label
        const inventory = await InventoryItem.findOne({
            item: prId,
            sizeLabel: { $regex: new RegExp(`^${payload.size}$`, 'i') } // Case-insensitive match
        });

        if (!inventory) {
            // Get all available inventory for this product to help debug
            const availableInventory = await InventoryItem.find({ item: prId });
            const availableSizes = availableInventory.map(inv => inv.sizeLabel);
            
            return {
                success: false,
                message: `Inventory not found for ${product.name} - ${payload.size}. Available sizes: ${availableSizes.join(', ') || 'None'}`
            };
        }

        if (inventory.stock < payload.quantity) {
            return {
                success: false,
                message: `Insufficient stock for ${product.name} - ${payload.size}. Available: ${inventory.stock}, Requested: ${payload.quantity}`
            };
        }

        // Deduct stock
        inventory.stock -= payload.quantity;
        await inventory.save();

        // Determine orderedBy based on who is creating the order
        let orderedById;
        let orderedByModel;
        let customerEmail = payload.customerEmail;
        let customerName = payload.customerName;

        if (user && userType === 'customer') {
            // Customer creating their own order
            orderedById = user._id;
            orderedByModel = 'Customer';
            customerEmail = user.email;
            customerName = user.name;
        } else if (user && userType === 'admin') {
            // Admin creating order for a customer
            orderedById = user._id;
            orderedByModel = 'Admin';
            
            // Customer email must be provided by admin
            if (!payload.customerEmail) {
                return {
                    success: false,
                    message: 'Customer email is required when creating order as admin'
                };
            }
            
            // Verify customer exists
            const Customer = require('../models/Customer.Model');
            const customer = await Customer.findOne({ email: payload.customerEmail });
            if (!customer) {
                return {
                    success: false,
                    message: `Customer not found with email: ${payload.customerEmail}`
                };
            }
            customerName = customer.name;
        } else {
            return {
                success: false,
                message: 'Invalid user type for order creation. Must be "customer" or "admin"'
            };
        }

        // Create order
        const newOrder = new Order({
            orderId: await generateId(),
            customerName: customerName,
            customerEmail: customerEmail,
            address: payload.address,
            productId: payload.productId,
            size: payload.size,
            quantity: payload.quantity,
            designDetails: payload.designDetails || [],
            amount: payload.amount,
            status: payload.status || 'Pending',
            paymentStatus: payload.paymentStatus || 'Unpaid',
            receivingMode: payload.receivingMode,
            expectedDelivery: payload.expectedDelivery,
            isProvided: payload.isProvided !== undefined ? payload.isProvided : true,
            orderedBy: orderedById,
            statusHistory: [{
                status: payload.status || 'Pending',
                timestamp: new Date(),
                notes: payload.notes || 'Order created',
                updatedBy: orderedById,
                updatedByModel: orderedByModel
            }]
        });

        await newOrder.save();
        
        // Populate the orderedBy details
        await newOrder.populate('orderedBy');

        return {
            success: true,
            message: 'Order created successfully',
            data: {
                ...newOrder.toObject(),
                inventoryDetails: {
                    previousStock: inventory.stock + payload.quantity,
                    newStock: inventory.stock,
                    deducted: payload.quantity
                }
            }
        };

    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
}

    // ─────────────────────────────────────────
    // GET ALL ORDERS
    // ─────────────────────────────────────────
    async getAllOrders(filters = {}) {
        try {
            const query = {};
            
            // Apply filters
            if (filters.status) query.status = filters.status;
            if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
            if (filters.receivingMode) query.receivingMode = filters.receivingMode;
            if (filters.customerEmail) query.customerEmail = filters.customerEmail;
            if (filters.productId) query.productId = filters.productId;
            if (filters.orderedBy) query.orderedBy = filters.orderedBy;
            if (filters.orderedByModel) query.orderedByModel = filters.orderedByModel;
            
            // Date range filters
            if (filters.startDate) {
                query.orderedAt = { $gte: new Date(filters.startDate) };
            }
            if (filters.endDate) {
                query.orderedAt = { ...query.orderedAt, $lte: new Date(filters.endDate) };
            }

            const orders = await Order.find(query)
                .populate('orderedByDetails')
                .populate('updatedByDetails')
                .sort({ orderedAt: -1 });

            return { success: true, data: orders };
        } catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ORDER BY ID
    // ─────────────────────────────────────────
    async getOrderById(orderId) {
        try {
            const order = await Order.findOne({ orderId })
                .populate('orderedByDetails')
                .populate('updatedByDetails');
            
            if (!order) {
                return { success: false, message: 'Order not found' };
            }

            // Get product details
            const product = await Product.findOne({ productId: order.productId });
            
            return { 
                success: true, 
                data: {
                    ...order.toObject(),
                    productDetails: product
                }
            };
        } catch (error) {
            console.error('Error fetching order:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ORDERS BY ORDERED BY (Admin/Customer)
    // ─────────────────────────────────────────
    async getOrdersByOrderedBy(orderedById, orderedByModel) {
        try {
            const orders = await Order.find({ 
                orderedBy: orderedById, 
                orderedByModel: orderedByModel 
            })
                .populate('orderedByDetails')
                .sort({ orderedAt: -1 });
            
            return { 
                success: true, 
                data: orders,
                count: orders.length
            };
        } catch (error) {
            console.error('Error fetching orders by orderedBy:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ORDERS BY CUSTOMER EMAIL
    // ─────────────────────────────────────────
    async getOrdersByCustomerEmail(customerEmail) {
        try {
            const orders = await Order.find({ customerEmail })
                .populate('orderedByDetails')
                .sort({ orderedAt: -1 });
            
            if (orders.length === 0) {
                return { success: false, message: 'No orders found for this customer' };
            }
            
            return { success: true, data: orders };
        } catch (error) {
            console.error('Error fetching customer orders:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE ORDER STATUS with polymorphic updater
    // ─────────────────────────────────────────
    async updateOrderStatus(orderId, newStatus, notes = '', user = null, userType = null) {
        try {
            const validStatuses = ['Pending', 'Scheduled', 'In Production', 'Out for Delivery', 'Completed', 'Cancelled'];
            
            if (!validStatuses.includes(newStatus)) {
                return { success: false, message: 'Invalid status' };
            }

            const order = await Order.findOne({ orderId });
            
            if (!order) {
                return { success: false, message: 'Order not found' };
            }

            // If order is already completed or cancelled, prevent status change
            if (order.status === 'Completed' || order.status === 'Cancelled') {
                return { 
                    success: false, 
                    message: `Cannot change status of ${order.status.toLowerCase()} order` 
                };
            }

            // If cancelling order, restore inventory
            if (newStatus === 'Cancelled' && order.status !== 'Cancelled') {
                const product = await Product.findOne({ productId: order.productId });
                if (product) {
                    const inventory = await InventoryItem.findOne({
                        item: product._id,
                        sizeLabel: order.size
                    });
                    
                    if (inventory) {
                        inventory.stock += order.quantity;
                        await inventory.save();
                    }
                }
            }

            const oldStatus = order.status;
            order.status = newStatus;
            order.statusHistory.push({
                status: newStatus,
                timestamp: new Date(),
                notes: notes,
                updatedBy: user ? user._id : null,
                updatedByModel: userType
            });
            order.updatedAt = new Date();
            if (user) {
                order.updatedBy = user._id;
                order.updatedByModel = userType;
            }
            
            await order.save();
            await order.populate('orderedByDetails updatedByDetails');

            return {
                success: true,
                message: `Order status updated from ${oldStatus} to ${newStatus}`,
                data: order
            };

        } catch (error) {
            console.error('Error updating order status:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE PAYMENT STATUS
    // ─────────────────────────────────────────
    async updatePaymentStatus(orderId, paymentStatus, amountPaid = null, user = null, userType = null) {
        try {
            const validStatuses = ['Paid', 'Partial', 'Unpaid'];
            
            if (!validStatuses.includes(paymentStatus)) {
                return { success: false, message: 'Invalid payment status' };
            }

            const order = await Order.findOne({ orderId });
            
            if (!order) {
                return { success: false, message: 'Order not found' };
            }

            const oldPaymentStatus = order.paymentStatus;
            order.paymentStatus = paymentStatus;
            
            // If payment status is changed to Partial, track partial payments
            if (paymentStatus === 'Partial' && amountPaid) {
                order.partialPayments = order.partialPayments || [];
                order.partialPayments.push({
                    amount: amountPaid,
                    date: new Date(),
                    updatedBy: user ? user._id : null,
                    updatedByModel: userType
                });
            }
            
            order.updatedAt = new Date();
            if (user) {
                order.updatedBy = user._id;
                order.updatedByModel = userType;
            }
            
            await order.save();
            await order.populate('orderedByDetails updatedByDetails');

            return {
                success: true,
                message: `Payment status updated from ${oldPaymentStatus} to ${paymentStatus}`,
                data: order
            };

        } catch (error) {
            console.error('Error updating payment status:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE ORDER
    // ─────────────────────────────────────────
    async updateOrder(orderId, payload, user = null, userType = null) {
        try {
            const { orderId: _id, orderedAt, ...updateData } = payload;
            
            // Don't allow updating certain fields
            delete updateData.orderId;
            delete updateData.orderedAt;
            delete updateData.orderedBy;
            delete updateData.orderedByModel;
            
            // If updating quantity, adjust inventory
            if (updateData.quantity) {
                const order = await Order.findOne({ orderId });
                if (!order) {
                    return { success: false, message: 'Order not found' };
                }
                
                const quantityDiff = updateData.quantity - order.quantity;
                const product = await Product.findOne({ productId: order.productId });
                
                if (product && quantityDiff !== 0) {
                    const inventory = await InventoryItem.findOne({
                        item: product._id,
                        sizeLabel: order.size
                    });
                    
                    if (inventory) {
                        if (quantityDiff > 0 && inventory.stock < quantityDiff) {
                            return {
                                success: false,
                                message: `Insufficient stock to increase quantity by ${quantityDiff}`
                            };
                        }
                        inventory.stock -= quantityDiff;
                        await inventory.save();
                    }
                }
            }
            
            updateData.updatedAt = new Date();
            if (user) {
                updateData.updatedBy = user._id;
                updateData.updatedByModel = userType;
            }
            
            const order = await Order.findOneAndUpdate(
                { orderId },
                updateData,
                { new: true, runValidators: true }
            ).populate('orderedByDetails updatedByDetails');
            
            if (!order) {
                return { success: false, message: 'Order not found' };
            }

            return {
                success: true,
                message: 'Order updated successfully',
                data: order
            };

        } catch (error) {
            console.error('Error updating order:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DELETE ORDER
    // ─────────────────────────────────────────
    async deleteOrder(orderId) {
        try {
            const order = await Order.findOne({ orderId });
            
            if (!order) {
                return { success: false, message: 'Order not found' };
            }
            
            // Restore inventory if order is not completed or cancelled
            if (order.status !== 'Completed' && order.status !== 'Cancelled') {
                const product = await Product.findOne({ productId: order.productId });
                if (product) {
                    const inventory = await InventoryItem.findOne({
                        item: product._id,
                        sizeLabel: order.size
                    });
                    
                    if (inventory) {
                        inventory.stock += order.quantity;
                        await inventory.save();
                    }
                }
            }
            
            await Order.findOneAndDelete({ orderId });
            
            return { 
                success: true, 
                message: 'Order deleted successfully',
                data: { orderId, status: order.status }
            };
        } catch (error) {
            console.error('Error deleting order:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ORDER STATISTICS
    // ─────────────────────────────────────────
    async getOrderStatistics() {
        try {
            const totalOrders = await Order.countDocuments();
            const pendingOrders = await Order.countDocuments({ status: 'Pending' });
            const scheduledOrders = await Order.countDocuments({ status: 'Scheduled' });
            const inProductionOrders = await Order.countDocuments({ status: 'In Production' });
            const outForDeliveryOrders = await Order.countDocuments({ status: 'Out for Delivery' });
            const completedOrders = await Order.countDocuments({ status: 'Completed' });
            const cancelledOrders = await Order.countDocuments({ status: 'Cancelled' });
            
            const totalRevenue = await Order.aggregate([
                { $match: { status: 'Completed', paymentStatus: 'Paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            
            const pendingRevenue = await Order.aggregate([
                { $match: { paymentStatus: 'Unpaid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            
            const ordersByMonth = await Order.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: '$orderedAt' },
                            month: { $month: '$orderedAt' }
                        },
                        count: { $sum: 1 },
                        revenue: { $sum: '$amount' }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 6 }
            ]);

            const ordersByOrderedByType = await Order.aggregate([
                {
                    $group: {
                        _id: '$orderedByModel',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ]);

            return {
                success: true,
                data: {
                    totalOrders,
                    pendingOrders,
                    scheduledOrders,
                    inProductionOrders,
                    outForDeliveryOrders,
                    completedOrders,
                    cancelledOrders,
                    totalRevenue: totalRevenue[0]?.total || 0,
                    pendingRevenue: pendingRevenue[0]?.total || 0,
                    ordersByMonth,
                    ordersByOrderedByType
                }
            };
        } catch (error) {
            console.error('Error getting order statistics:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ORDERS BY DATE RANGE
    // ─────────────────────────────────────────
    async getOrdersByDateRange(startDate, endDate) {
        try {
            const orders = await Order.find({
                orderedAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            })
                .populate('orderedByDetails')
                .sort({ orderedAt: -1 });
            
            return { success: true, data: orders };
        } catch (error) {
            console.error('Error fetching orders by date range:', error);
            throw error;
        }
    }
}

module.exports = new OrderService();