// routes/DriverRoutes.js
const express = require('express');
const router = express.Router();
const DriverController = require('../controller/DriverController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// All driver routes require admin authentication
router.use(verifyAdminToken);

// Driver management
router.post('/create', DriverController.createDriver);
router.get('/all', DriverController.getAllDrivers);
router.get('/available', DriverController.getAvailableDrivers);
router.get('/stats', DriverController.getDriverStats);
router.get('/:driverId', DriverController.getDriverById);
router.put('/:driverId', DriverController.updateDriver);
router.delete('/:driverId', DriverController.deleteDriver);
router.patch('/:driverId/toggle-availability', DriverController.toggleAvailability);

module.exports = router;