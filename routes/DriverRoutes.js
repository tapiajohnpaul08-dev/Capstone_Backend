// routes/DriverRoutes.js
const express = require('express');
const router = express.Router();
const DriverController = require('../controller/DriverController');
const { 
    verifyAdminToken, 
    verifyDriverToken 
} = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads/proofs/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for proof of delivery uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `proof-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

// ============ PUBLIC ROUTES ============
router.post('/login', DriverController.login);

// Profile management
router.get('/profile', verifyDriverToken, DriverController.getProfile);
router.put('/profile', verifyDriverToken, DriverController.updateProfile);
router.post('/change-password', verifyDriverToken, DriverController.changePassword);
router.patch('/:driverId/toggle-availability', verifyDriverToken, DriverController.toggleAvailability);

// Order management
router.get('/orders/assigned', verifyDriverToken, DriverController.getAssignedOrders);
router.get('/orders/history', verifyDriverToken, DriverController.getOrderHistory);

// ✅ FIX: Reorder middleware - Authenticate FIRST, then handle file upload
router.patch(
    '/orders/:orderId/status',
    verifyDriverToken,              // 1. Authenticate first
    upload.single('proofOfDelivery'), // 2. Then handle file upload
    DriverController.updateOrderStatus // 3. Then the controller
);

// ============ ADMIN ONLY ROUTES ============
router.post('/create', verifyAdminToken, DriverController.createDriver);
router.get('/all', verifyAdminToken, DriverController.getAllDrivers);
router.get('/available', verifyAdminToken, DriverController.getAvailableDrivers);
router.get('/stats', verifyAdminToken, DriverController.getDriverStats);
router.get('/:driverId', verifyAdminToken, DriverController.getDriverById);
router.put('/:driverId', verifyAdminToken, DriverController.updateDriver);
router.delete('/:driverId', verifyAdminToken, DriverController.deleteDriver);

module.exports = router;