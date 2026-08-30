// routes/DriverRoutes.js
const express = require('express');
const router = express.Router();
const DriverController = require('../controller/DriverController');
const { 
    verifyAdminToken, 
    verifyDriverToken 
} = require('../middleware/authMiddleware');

// ============ PUBLIC ROUTES ============
router.post('/login', DriverController.login);

// ============ DRIVER AUTHENTICATED ROUTES ============

// Profile management
router.get('/profile', DriverController.getProfile);
router.put('/profile', DriverController.updateProfile);
router.post('/change-password', DriverController.changePassword);

// Order management
router.get('/orders/assigned', DriverController.getAssignedOrders);
router.get('/orders/history', DriverController.getOrderHistory);

// Update order status - Driver can only update to 'out-for-delivery' or 'completed'
// Using multer for file upload (proof of delivery)
const multer = require('multer');
const upload = multer({ 
    dest: 'uploads/proofs/',
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
router.patch(
    '/orders/:orderId/status', 
    upload.single('proofOfDelivery'),
    DriverController.updateOrderStatus
);



// Driver management
router.post('/create', verifyAdminToken, DriverController.createDriver);
router.get('/all', verifyAdminToken, DriverController.getAllDrivers);
router.get('/available', verifyAdminToken, DriverController.getAvailableDrivers);
router.get('/stats', verifyAdminToken, DriverController.getDriverStats);
router.get('/:driverId', verifyAdminToken, DriverController.getDriverById);
router.put('/:driverId', verifyAdminToken, DriverController.updateDriver);
router.delete('/:driverId', verifyAdminToken, DriverController.deleteDriver);
router.patch('/:driverId/toggle-availability', verifyAdminToken, DriverController.toggleAvailability);

module.exports = router;