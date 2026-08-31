const adminService = require('../services/AdminServices');
const customerService = require('../services/CustomerServices');
const driverService = require('../services/DriverServices');
const Driver = require('../models/Driver.Model');

// ─────────────────────────────────────────
// ADMIN MIDDLEWARE
// ─────────────────────────────────────────
const verifyAdminToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const response = await adminService.verifyToken(token);
        console.log('Admin verify response:', response.success);
        if (!response.success) {
            return res.status(401).json({
                success: false,
                message: response.message,
            });
        }

        req.admin = response.data;
        next();

    } catch (error) {
        console.error('Admin auth error:', error);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// ─────────────────────────────────────────
// CUSTOMER MIDDLEWARE
// ─────────────────────────────────────────
const verifyCustomerToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const response = await customerService.verifyToken(token);

        if (!response.success) {
            return res.status(401).json({
                success: false,
                message: response.message
            });
        }

        req.customer = response.data;
        next();

    } catch (error) {
        console.error('Customer auth error:', error);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// ─────────────────────────────────────────
// DRIVER MIDDLEWARE - ✅ FIXED
// ─────────────────────────────────────────
const verifyDriverToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const response = await driverService.verifyToken(token);
        console.log('Driver verify response:', response.success);
        
        if (!response.success) {
            return res.status(401).json({
                success: false,
                message: response.message,
            });
        }

        // ✅ FIX: Set BOTH req.driver AND req.user for compatibility
        // The controller expects req.user
        const driverData = response.data;
        
        req.driver = driverData;
        req.user = {
            id: driverData._id || driverData.id,
            driverId: driverData.driverId,
            email: driverData.email,
            username: driverData.username,
            role: 'driver',
            firstName: driverData.firstName,
            lastName: driverData.lastName,
            phoneNumber: driverData.phoneNumber,
            plateNumber: driverData.plateNumber,
            vehicleDescription: driverData.vehicleDescription,
            available: driverData.available,
            assignedOrdersCount: driverData.assignedOrdersCount || 0
        };

        console.log(`✅ Driver authenticated: ${req.user.driverId} (${req.user.email})`);
        next();

    } catch (error) {
        console.error('Driver auth error:', error);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// ─────────────────────────────────────────
// EITHER ADMIN OR CUSTOMER (shared routes)
// ─────────────────────────────────────────
const verifyAnyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        // Try admin first, then customer
        const adminResponse = await adminService.verifyToken(token);
        if (adminResponse.success) {
            req.admin = adminResponse.data;
            req.userType = 'admin';
            return next();
        }

        const customerResponse = await customerService.verifyToken(token);
        if (customerResponse.success) {
            req.customer = customerResponse.data;
            req.userType = 'customer';
            return next();
        }

        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });

    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// ─────────────────────────────────────────
// ROLE CHECK (admin only)
// ─────────────────────────────────────────
const checkRole = (...roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admins only.'
            });
        }

        if (!roles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${roles.join(' or ')}`
            });
        }

        next();
    };
};

module.exports = {
    verifyAdminToken,
    verifyCustomerToken,
    verifyDriverToken,
    verifyAnyToken,
    checkRole
};