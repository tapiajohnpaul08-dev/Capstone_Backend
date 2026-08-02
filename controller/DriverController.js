// controller/DriverController.js
const driverService = require('../services/DriverServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class DriverController {
    
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

    // Get driver statistics
    getDriverStats = asyncTryCatch(async (req, res, next) => {
        const response = await driverService.getDriverStats();
        res.status(200).json(response);
    });
}

module.exports = new DriverController();