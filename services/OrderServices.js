// services/OrderService.js
const Order = require('../models/Order.Model');
const InventoryItem = require('../models/InventoryItem.Model');
const Product = require('../models/Product.Model');
const generateId = require('../utils/generateId');

class OrderService {
    

async createOrder(payload, user = null, userType = null) {
    try {
        console.log('\n=== 🔵 CREATE ORDER STARTED ===');
        
        // Find product
        const product = await Product.findOne({ productId: payload.productId });
        if (!product) {
            return { success: false, message: 'Product not found' };
        }

        // Validate size
        const sizeExists = product.sizes.some(
            s => s.label.toLowerCase() === payload.size.toLowerCase()
        );
        if (!sizeExists) {
            return {
                success: false,
                message: `Size "${payload.size}" does not exist. Available: ${product.sizes.map(s => s.label).join(', ')}`
            };
        }

        // Find inventory - using 'product' field (matches your database)
        const inventory = await InventoryItem.findOne({
            product: product._id,
            sizeLabel: { $regex: new RegExp(`^${payload.size}$`, 'i') }
        });

        if (!inventory) {
            return {
                success: false,
                message: `Inventory not found for ${product.name} - ${payload.size}`
            };
        }

        if (inventory.stock < payload.quantity) {
            return {
                success: false,
                message: `Insufficient stock. Available: ${inventory.stock}, Requested: ${payload.quantity}`
            };
        }

        // Deduct stock
        const previousStock = inventory.stock;
        inventory.stock -= payload.quantity;
        await inventory.save();

        // Determine who placed the order
        let orderedById;
        let customerEmail = payload.customerEmail;
        let customerName = payload.customerName;

        if (user && userType === 'customer') {
            orderedById = user._id.toString();
            customerEmail = user.email;
            customerName = user.name;
        } else if (user && userType === 'admin') {
            orderedById = user._id.toString();
            if (!payload.customerEmail) {
                return {
                    success: false,
                    message: 'Customer email is required when creating order as admin'
                };
            }
        } else {
            return {
                success: false,
                message: 'Invalid user type'
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
                updatedBy: orderedById
            }]
        });

        await newOrder.save();

        return {
            success: true,
            message: 'Order created successfully',
            data: {
                ...newOrder.toObject(),
                inventoryDetails: {
                    productName: product.name,
                    size: inventory.sizeLabel,
                    previousStock: previousStock,
                    newStock: inventory.stock,
                    deducted: payload.quantity,
                    inventoryId: inventory.inventoryId
                }
            }
        };

    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
}

    // ─────────────────────────────────────────
    // UPDATE ORDER STATUS (with inventory restoration on cancel)
    // ─────────────────────────────────────────
    async updateOrderStatus(orderId, newStatus, notes = '', user = null) {
        try {
            const validStatuses = ['Pending', 'Scheduled', 'In Production', 'Out for Delivery', 'Completed', 'Cancelled'];
            
            if (!validStatuses.includes(newStatus)) {
                return { success: false, message: 'Invalid status' };
            }

            const order = await Order.findOne({ orderId });
            
            if (!order) {
                return { success: false, message: 'Order not found' };
            }

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
                    // In your OrderService createOrder method
const inventory = await InventoryItem.findOne({
    product: product._id,  // ✅ This is correct for your data
    sizeLabel: { $regex: new RegExp(`^${payload.size}$`, 'i') }
});
                    
                    if (inventory) {
                        inventory.stock += order.quantity;
                        await inventory.save();
                        console.log(`Inventory restored: +${order.quantity} to ${inventory.sizeLabel}`);
                    }
                }
            }

            const oldStatus = order.status;
            order.status = newStatus;
            order.statusHistory.push({
                status: newStatus,
                timestamp: new Date(),
                notes: notes,
                updatedBy: user ? user._id.toString() : null
            });
            order.updatedAt = new Date();
            if (user) {
                order.updatedBy = user._id.toString();
            }
            
            await order.save();

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
    // UPDATE ORDER (with quantity adjustment)
    // ─────────────────────────────────────────
    async updateOrder(orderId, payload, user = null) {
        try {
            const { orderId: _id, orderedAt, orderedBy, ...updateData } = payload;
            
            delete updateData.orderId;
            delete updateData.orderedAt;
            
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
    product: product._id,  // ← Use 'product' field
    sizeLabel: { $regex: new RegExp(`^${order.size}$`, 'i') }
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
                updateData.updatedBy = user._id.toString();
            }
            
            const order = await Order.findOneAndUpdate(
                { orderId },
                updateData,
                { new: true, runValidators: true }
            );
            
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
    // DELETE ORDER (with inventory restoration)
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
    product: product._id,  // ← Use 'product' field
    sizeLabel: { $regex: new RegExp(`^${order.size}$`, 'i') }
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
    // GET ALL ORDERS
    // ─────────────────────────────────────────
    async getAllOrders(filters = {}) {
        try {
            const query = {};
            
            if (filters.status) query.status = filters.status;
            if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
            if (filters.receivingMode) query.receivingMode = filters.receivingMode;
            if (filters.customerEmail) query.customerEmail = filters.customerEmail;
            if (filters.productId) query.productId = filters.productId;
            if (filters.orderedBy) query.orderedBy = filters.orderedBy;
            
            if (filters.startDate) {
                query.orderedAt = { $gte: new Date(filters.startDate) };
            }
            if (filters.endDate) {
                query.orderedAt = { ...query.orderedAt, $lte: new Date(filters.endDate) };
            }

            const orders = await Order.find(query).sort({ orderedAt: -1 });
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
            const order = await Order.findOne({ orderId });
            
            if (!order) {
                return { success: false, message: 'Order not found' };
            }

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
    // GET ORDERS BY ORDERED BY
    // ─────────────────────────────────────────
    async getOrdersByOrderedBy(orderedById) {
        try {
            const orders = await Order.find({ orderedBy: orderedById })
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
    // UPDATE PAYMENT STATUS
    // ─────────────────────────────────────────
    async updatePaymentStatus(orderId, paymentStatus, amountPaid = null, user = null) {
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
            
            if (paymentStatus === 'Partial' && amountPaid) {
                order.partialPayments = order.partialPayments || [];
                order.partialPayments.push({
                    amount: amountPaid,
                    date: new Date(),
                    updatedBy: user ? user._id.toString() : null
                });
            }
            
            order.updatedAt = new Date();
            if (user) {
                order.updatedBy = user._id.toString();
            }
            
            await order.save();

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
    // GET ORDER STATISTICS
    // ─────────────────────────────────────────
    async getOrderStatistics() {
        try {
            const totalOrders = await Order.countDocuments();
            const pendingOrders = await Order.countDocuments({ status: 'Pending' });
            const completedOrders = await Order.countDocuments({ status: 'Completed' });
            const cancelledOrders = await Order.countDocuments({ status: 'Cancelled' });
            
            const totalRevenue = await Order.aggregate([
                { $match: { status: 'Completed', paymentStatus: 'Paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            return {
                success: true,
                data: {
                    totalOrders,
                    pendingOrders,
                    completedOrders,
                    cancelledOrders,
                    totalRevenue: totalRevenue[0]?.total || 0
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
            }).sort({ orderedAt: -1 });
            
            return { success: true, data: orders };
        } catch (error) {
            console.error('Error fetching orders by date range:', error);
            throw error;
        }
    }
}

module.exports = new OrderService();