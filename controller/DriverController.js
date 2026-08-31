// controller/DriverController.js
const driverService = require('../services/DriverServices');
const OrderService = require('../services/OrderServices');
const asyncTryCatch = require('../utils/tryAndCatch');
const bcrypt = require('bcrypt');
const Driver = require('../models/Driver.Model');
const Order = require('../models/Order.Model');

class DriverController {
    
    // ============ AUTHENTICATION ============
    
    // Driver login
    login = asyncTryCatch(async (req, res, next) => {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const result = await driverService.login(email, password);
        
        if (!result.success) {
            return res.status(401).json({
                success: false,
                message: result.message
            });
        }

        res.status(200).json({
            success: true,
            message: result.message,
            token: result.token,
            data: result.data
        });
    });

    // Get driver profile
    getProfile = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.user;
        const response = await driverService.getDriverById(driverId);
        
        if (!response.success) {
            return res.status(404).json(response);
        }
        
        res.status(200).json(response);
    });

    // Update driver profile
    updateProfile = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.user;
        
        const allowedUpdates = ['firstName', 'middleName', 'lastName', 'phoneNumber', 'vehicleDescription'];
        const updateData = {};
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        const response = await driverService.updateDriver(driverId, updateData);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // Change password
    changePassword = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.user;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        const driver = await Driver.findOne({ driverId });
        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        const isValid = await bcrypt.compare(currentPassword, driver.password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        const salt = await bcrypt.genSalt(10);
        driver.password = await bcrypt.hash(newPassword, salt);
        driver.updatedAt = new Date();
        await driver.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    });

    // ============ DRIVER MANAGEMENT (Admin) ============
    
    createDriver = asyncTryCatch(async (req, res, next) => {
        const response = await driverService.createDriver(req.body);
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    getAllDrivers = asyncTryCatch(async (req, res, next) => {
        const filters = req.query;
        const response = await driverService.getAllDrivers(filters);
        res.status(200).json(response);
    });

    getAvailableDrivers = asyncTryCatch(async (req, res, next) => {
        const response = await driverService.getAvailableDrivers();
        res.status(200).json(response);
    });

    getDriverById = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.params;
        const response = await driverService.getDriverById(driverId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    updateDriver = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.params;
        const response = await driverService.updateDriver(driverId, req.body);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    deleteDriver = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.params;
        const response = await driverService.deleteDriver(driverId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    toggleAvailability = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.params;
        const response = await driverService.toggleAvailability(driverId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    getDriverStats = asyncTryCatch(async (req, res, next) => {
        const response = await driverService.getDriverStats();
        res.status(200).json(response);
    });

    // ============ DRIVER ORDERS (Authenticated) ============
    
    // Get assigned orders for driver
    getAssignedOrders = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.user;
        
        console.log(`📡 Fetching assigned orders for driver: ${driverId}`);
        
        const orders = await Order.find({ 
            'driverDetails.driverId': driverId,
            status: { $in: ['Out for Delivery', 'Scheduled'] }
        }).sort({ createdAt: -1 });
        
        const formattedOrders = orders.map(order => ({
            id: order._id,
            _id: order._id,
            orderId: order.orderId,
            customerName: order.customer?.name || order.customerName || 'Unknown Customer',
            customerPhone: order.customer?.phone || order.customerPhone || 'N/A',
            address: order.address || order.customer?.address || 'No address provided',
            items: order.items?.map(item => `${item.name} (${item.quantity}pcs)`) || ['Items not specified'],
            total: order.totalAmount || order.amount || 0,
            status: this._mapOrderStatus(order.status),
            createdAt: order.createdAt || order.orderedAt,
            deliveryFee: 0,
            notes: order.notes || '',
            proofOfDelivery: order.proofOfDelivery || null,
            driverId: driverId
        }));
        
        res.status(200).json({
            success: true,
            data: formattedOrders,
            count: formattedOrders.length
        });
    });

    // Get order history for driver
    getOrderHistory = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.user;
        
        console.log(`📡 Fetching order history for driver: ${driverId}`);
        
        const orders = await Order.find({ 
            'driverDetails.driverId': driverId,
            status: { $in: ['Completed', 'Cancelled'] }
        }).sort({ updatedAt: -1 });
        
        const formattedOrders = orders.map(order => ({
            id: order._id,
            _id: order._id,
            orderId: order.orderId,
            customerName: order.customer?.name || order.customerName || 'Unknown Customer',
            customerPhone: order.customer?.phone || order.customerPhone || 'N/A',
            address: order.address || order.customer?.address || 'No address provided',
            items: order.items?.map(item => `${item.name} (${item.quantity}pcs)`) || ['Items not specified'],
            total: order.totalAmount || order.amount || 0,
            status: this._mapOrderStatus(order.status),
            createdAt: order.createdAt || order.orderedAt,
            completedAt: order.status === 'Completed' ? order.updatedAt : null,
            cancelledAt: order.status === 'Cancelled' ? order.updatedAt : null,
            deliveryFee: 0,
            notes: order.notes || '',
            proofOfDelivery: order.proofOfDelivery || null,
            driverId: driverId
        }));
        
        res.status(200).json({
            success: true,
            data: formattedOrders,
            count: formattedOrders.length
        });
    });

    /**
     * Update order status - Driver can only mark as 'completed'
     * Uses OrderService.updateOrderStatus like OrderController
     * 
     * OrderController passes: orderId, status, notes, productionSchedule, driverId, user (req.admin)
     * We need to match this pattern with a proper user object
     */
    updateOrderStatus = asyncTryCatch(async (req, res, next) => {
        console.log('🔵 Driver updateOrderStatus called');
        console.log('📦 Order ID:', req.params.orderId);
        console.log('📦 Status:', req.body.status);
        console.log('👤 Driver ID:', req.user.driverId);
        
        const { orderId } = req.params;
        const { status, notes } = req.body;
        const { driverId } = req.user;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Driver can only mark as 'completed'
        if (status !== 'completed') {
            return res.status(403).json({
                success: false,
                message: 'You can only mark orders as completed'
            });
        }

        // Verify the order belongs to this driver
        const order = await Order.findOne({ 
            _id: orderId,
            'driverDetails.driverId': driverId
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or not assigned to you'
            });
        }

        // Check if order is already completed or cancelled
        if (order.status === 'Completed' || order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: `Cannot change status of a ${order.status.toLowerCase()} order`
            });
        }

        // Check if order is in the correct state to be completed
        if (order.status !== 'Out for Delivery') {
            return res.status(400).json({
                success: false,
                message: 'You can only mark orders that are "Out for Delivery" as completed'
            });
        }

        // ✅ Get driver info for the user object
        const driver = await Driver.findOne({ driverId });
        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        // ✅ Create a user object that matches what OrderService expects
        // OrderService.updatePaymentStatus expects user._id.toString()
        // So we need to ensure _id is a valid MongoDB ObjectId
        const user = {
            _id: driver._id,  // This is the MongoDB ObjectId
            id: driver._id,
            driverId: driver.driverId,
            firstName: driver.firstName,
            lastName: driver.lastName,
            email: driver.email,
            role: 'driver'
        };

        console.log('👤 User object being passed to OrderService:', {
            _id: user._id,
            driverId: user.driverId,
            email: user.email
        });

        // ✅ Use OrderService.updateOrderStatus (same as OrderController)
        // OrderController passes: orderId, status, notes, productionSchedule, driverId, user
        const response = await OrderService.updateOrderStatus(
            order.orderId,          // orderId (the string identifier)
            'Completed',            // newStatus (backend status)
            notes || 'Order marked as completed by driver', // notes
            null,                   // productionSchedule
            driverId,               // driverId (for logging/audit)
            user                    // ✅ Pass the user object with _id
        );

        if (!response.success) {
            return res.status(400).json(response);
        }

        // Handle proof of delivery upload if provided
        if (req.file && response.data) {
            const updatedOrder = response.data;
            updatedOrder.proofOfDelivery = req.file.path || req.file.filename;
            await updatedOrder.save();
        }

        // Format response for frontend
        const formattedOrder = {
            id: order._id,
            _id: order._id,
            orderId: order.orderId,
            customerName: order.customer?.name || order.customerName,
            customerPhone: order.customer?.phone || order.customerPhone,
            address: order.address || order.customer?.address,
            items: order.items?.map(item => `${item.name} (${item.quantity}pcs)`) || [],
            total: order.totalAmount || order.amount,
            status: 'completed',
            createdAt: order.createdAt || order.orderedAt,
            notes: order.notes,
            proofOfDelivery: order.proofOfDelivery || null,
            completedAt: new Date().toISOString()
        };

        res.status(200).json({
            success: true,
            message: 'Order marked as completed successfully',
            data: formattedOrder
        });
    });

    // ============ PRIVATE HELPER METHODS ============
    
    _mapOrderStatus(backendStatus) {
        const statusMap = {
            'Pending': 'assigned',
            'Scheduled': 'assigned',
            'In Production': 'assigned',
            'Out for Delivery': 'out-for-delivery',
            'Completed': 'completed',
            'Cancelled': 'cancelled'
        };
        return statusMap[backendStatus] || 'assigned';
    }
}

module.exports = new DriverController();