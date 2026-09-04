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

// controller/DriverController.js
updateOrderStatus = asyncTryCatch(async (req, res, next) => {
    console.log('🔵 Driver updateOrderStatus called');
    console.log('📦 Order ID:', req.params.orderId);
    console.log('📦 Status from body:', req.body.status);
    console.log('📦 File received:', req.file ? 'Yes' : 'No');
    console.log('👤 Driver ID:', req.user.driverId);
    
    const { orderId } = req.params;
    // Get status from body - with multer, it should be a string
    let { status, notes } = req.body;
    const { driverId } = req.user;

    // Debug: Log what we received
    console.log('📦 Status type:', typeof status);
    console.log('📦 Status value:', status);

    // If status is still an object (FormData issue), try to extract it
    if (status && typeof status === 'object') {
        console.log('⚠️ Status is an object, attempting to extract...');
        status = status.toString();
        console.log('📦 Extracted status:', status);
    }

    if (!status) {
        return res.status(400).json({
            success: false,
            message: 'Status is required'
        });
    }

    // Driver can only mark as 'completed'
    // Accept both 'completed' and 'Completed'
    const normalizedStatus = status.toLowerCase().trim();
    if (normalizedStatus !== 'completed') {
        console.log('❌ Invalid status:', status);
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

    // Handle proof of delivery upload to Cloudinary
    let proofImageUrl = null;
    if (req.file) {
        try {
            const cloudinary = require('../config/cloudinary');
            const fs = require('fs');
            
            console.log('📤 Uploading proof to Cloudinary...');
            
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'beverage/proofs',
                transformation: [
                    { width: 800, height: 800, crop: 'limit', quality: 'auto' },
                    { fetch_format: 'auto' }
                ]
            });
            
            proofImageUrl = result.secure_url;
            console.log('✅ Proof uploaded to Cloudinary:', proofImageUrl);
            
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        } catch (uploadError) {
            console.error('❌ Cloudinary upload error:', uploadError);
        }
    }

    // Get driver info
    const driver = await Driver.findOne({ driverId });
    if (!driver) {
        return res.status(404).json({
            success: false,
            message: 'Driver not found'
        });
    }

    // Create user object for OrderService
    const user = {
        _id: driver._id,
        id: driver._id,
        driverId: driver.driverId,
        firstName: driver.firstName,
        lastName: driver.lastName,
        email: driver.email,
        role: 'driver'
    };

    // Use OrderService.updateOrderStatus
    const response = await OrderService.updateOrderStatus(
        order.orderId,
        'Completed',
        notes || 'Order marked as completed by driver',
        null,
        driverId,
        user
    );

    if (!response.success) {
        return res.status(400).json(response);
    }

    // ✅ Store proof in statusHistory
    if (proofImageUrl) {
        // Find the most recent status history entry for this order
        if (order.statusHistory && order.statusHistory.length > 0) {
            // Update the last status history entry with proof
            const lastHistory = order.statusHistory[order.statusHistory.length - 1];
            if (lastHistory) {
                lastHistory.proof = proofImageUrl;
            }
        }
        
        // Also save proofOfDelivery on the order for easy access
        order.proofOfDelivery = proofImageUrl;
        await order.save();
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
        proofOfDelivery: proofImageUrl || order.proofOfDelivery || null,
        completedAt: new Date().toISOString()
    };

    // Update driver's completed orders count
    driver.completedOrdersCount += 1;
    await driver.save();

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