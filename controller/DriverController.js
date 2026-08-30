// controller/DriverController.js
const driverService = require('../services/DriverServices');
const asyncTryCatch = require('../utils/tryAndCatch');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver.Model');
const Order = require('../models/Order.Model');

class DriverController {
    
    // ============ AUTHENTICATION ============
    
    // Driver login
    login = asyncTryCatch(async (req, res, next) => {
    const response = await driverService.login(req.body);
    const status = response.success ? 200 : 401;
    res.status(status).json(response);
    });

    verifyToken = asyncTryCatch(async (req, res, next) => {
        const token = req.headers.authorization?.split(" ")[1];
        const response = await driverService.verifyToken(token);
        const status = response.success ? 200 : 401;
        res.status(status).json(response);
      });

    // Get driver profile (authenticated)
    getProfile = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.user;
        const response = await driverService.getDriverById(driverId);
        
        if (!response.success) {
            return res.status(404).json(response);
        }
        
        res.status(200).json(response);
    });

    // Update driver profile (authenticated)
    updateProfile = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.user;
        
        // Remove sensitive fields that shouldn't be updated via profile
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

    // Change password (authenticated)
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
    
    // Create driver (Admin only)
    createDriver = asyncTryCatch(async (req, res, next) => {
        const response = await driverService.createDriver(req.body);
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // Get all drivers (Admin only)
    getAllDrivers = asyncTryCatch(async (req, res, next) => {
        const filters = req.query;
        const response = await driverService.getAllDrivers(filters);
        res.status(200).json(response);
    });

    // Get available drivers (Admin only)
    getAvailableDrivers = asyncTryCatch(async (req, res, next) => {
        const response = await driverService.getAvailableDrivers();
        res.status(200).json(response);
    });

    // Get driver by ID (Admin only)
    getDriverById = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.params;
        const response = await driverService.getDriverById(driverId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // Update driver (Admin only)
    updateDriver = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.params;
        const response = await driverService.updateDriver(driverId, req.body);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // Delete driver (Admin only)
    deleteDriver = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.params;
        const response = await driverService.deleteDriver(driverId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // Toggle driver availability (Admin only)
    toggleAvailability = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.params;
        const response = await driverService.toggleAvailability(driverId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // Get driver statistics (Admin only)
    getDriverStats = asyncTryCatch(async (req, res, next) => {
        const response = await driverService.getDriverStats();
        res.status(200).json(response);
    });

    // ============ DRIVER ORDERS (Authenticated) ============
    
    // Get assigned orders for driver
    getAssignedOrders = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.body;
        
        // Find orders assigned to this driver with status 'assigned' or 'out-for-delivery'
        // Note: Order statuses are: "Pending", "Scheduled", "In Production", "Out for Delivery", "Completed", "Cancelled"
        const orders = await Order.find({ 
            'driverDetails.driverId': driverId,
            status: { $in: ['Out for Delivery', 'Scheduled'] }
        }).sort({ createdAt: -1 });
        
        // Transform to match frontend expected format
        const formattedOrders = orders.map(order => ({
            id: order._id,
            _id: order._id,
            orderId: order.orderId,
            customerName: order.customer?.name || order.customerName || 'Unknown Customer',
            customerPhone: order.customer?.phone || order.customerPhone || 'N/A',
            address: order.address || order.customer?.address || 'No address provided',
            items: order.items?.map(item => `${item.name} (${item.quantity}pcs)`) || ['Items not specified'],
            total: order.totalAmount || order.amount || 0,
            status: mapOrderStatus(order.status),
            createdAt: order.createdAt || order.orderedAt,
            deliveryFee: 0, // Not in Order model, default to 0
            notes: order.notes || '',
            proofOfDelivery: null,
            driverId: driverId
        }));
        
        res.status(200).json({
            success: true,
            data: formattedOrders,
            count: formattedOrders.length
        });
    });

    // Get order history for driver (completed/cancelled)
    getOrderHistory = asyncTryCatch(async (req, res, next) => {
        const { driverId } = req.user;
        
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
            status: mapOrderStatus(order.status),
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

    // Update order status (driver can only update to 'Out for Delivery' or 'Completed')
    updateOrderStatus = asyncTryCatch(async (req, res, next) => {
        const { orderId } = req.params;
        const { status } = req.body;
        const { driverId } = req.user;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Driver can only set these statuses
        const validDriverStatuses = ['out-for-delivery', 'completed'];
        if (!validDriverStatuses.includes(status)) {
            return res.status(403).json({
                success: false,
                message: 'You can only update orders to "Out for Delivery" or "Completed"'
            });
        }

        // Find the order - check if it's assigned to this driver
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

        // Map frontend status to backend status
        let backendStatus;
        if (status === 'out-for-delivery') {
            backendStatus = 'Out for Delivery';
        } else if (status === 'completed') {
            backendStatus = 'Completed';
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        // Check if transition is valid
        const currentStatus = order.status;
        if (currentStatus === 'Completed' || currentStatus === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: `Cannot change status of a ${currentStatus.toLowerCase()} order`
            });
        }

        // Driver can only go from 'Out for Delivery' to 'Completed'
        // or from 'Scheduled'/'In Production' to 'Out for Delivery'
        if (status === 'completed' && currentStatus !== 'Out for Delivery') {
            return res.status(400).json({
                success: false,
                message: 'You must mark the order as "Out for Delivery" before completing it'
            });
        }

        // Update order status using OrderService
        const OrderService = require('../services/OrderServices');
        const response = await OrderService.updateOrderStatus(
            order.orderId,
            backendStatus,
            req.body.notes || `Status updated by driver`,
            null, // productionSchedule
            driverId,
            { firstName: 'Driver', lastName: driverId } // user info
        );

        if (!response.success) {
            return res.status(400).json(response);
        }

        // If completed, decrement assigned orders count
        if (status === 'completed') {
            await driverService.decrementAssignedOrders(driverId);
            
            // Handle proof of delivery upload
            if (req.file) {
                // req.file contains the uploaded proof
                // Store the file path or Cloudinary URL
                console.log('Proof of delivery uploaded:', req.file.path || req.file.filename);
            }
        }

        // Return formatted response
        const formattedOrder = {
            id: order._id,
            _id: order._id,
            orderId: order.orderId,
            customerName: order.customer?.name || order.customerName,
            customerPhone: order.customer?.phone || order.customerPhone,
            address: order.address || order.customer?.address,
            items: order.items?.map(item => `${item.name} (${item.quantity}pcs)`) || [],
            total: order.totalAmount || order.amount,
            status: mapOrderStatus(backendStatus),
            createdAt: order.createdAt || order.orderedAt,
            notes: order.notes,
            proofOfDelivery: req.file ? req.file.path || req.file.filename : null
        };

        res.status(200).json({
            success: true,
            message: `Order status updated to ${backendStatus}`,
            data: formattedOrder
        });
    });
}

// Helper function to map backend status to frontend status
function mapOrderStatus(backendStatus) {
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

module.exports = new DriverController();