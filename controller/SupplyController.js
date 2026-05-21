// controller/SupplyController.js
const supplyService = require('../services/SupplyServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class SupplyController {

    // POST /api/v1/supplies
    createSupply = asyncTryCatch(async (req, res, next) => {
        const response = await supplyService.createSupply(req.body);
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // GET /api/v1/supplies
    getAllSupplies = asyncTryCatch(async (req, res, next) => {
        const response = await supplyService.getAllSupplies();
        res.status(200).json(response);
    });

    // GET /api/v1/supplies/active
    getActiveSupplies = asyncTryCatch(async (req, res, next) => {
        const response = await supplyService.getActiveSupplies();
        res.status(200).json(response);
    });

    // GET /api/v1/supplies/category/:category
    getSuppliesByCategory = asyncTryCatch(async (req, res, next) => {
        const response = await supplyService.getSuppliesByCategory(req.params.category);
        res.status(200).json(response);
    });

    // GET /api/v1/supplies/:supplyId
    getSupplyById = asyncTryCatch(async (req, res, next) => {
        const response = await supplyService.getSupplyById(req.params.supplyId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PUT /api/v1/supplies/:supplyId
    updateSupply = asyncTryCatch(async (req, res, next) => {
        const response = await supplyService.updateSupply(req.params.supplyId, req.body);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // DELETE /api/v1/supplies/:supplyId
    deleteSupply = asyncTryCatch(async (req, res, next) => {
        const response = await supplyService.deleteSupply(req.params.supplyId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });
}

module.exports = new SupplyController();