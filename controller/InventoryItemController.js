// controller/InventoryItemController.js
const inventoryService = require('../services/InventoryItemServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class InventoryController {

    // POST /api/v1/inventory/products/:productId
    addProductToInventory = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.addProductToInventory(
            req.params.productId, 
            req.body
        );
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // POST /api/v1/inventory/supplies/:supplyId
    addSupplyToInventory = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.addSupplyToInventory(
            req.params.supplyId, 
            req.body
        );
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // GET /api/v1/inventory
    getAllInventory = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.getAllInventory();
        res.status(200).json(response);
    });

    // GET /api/v1/inventory/type/:type
    getInventoryByType = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.getInventoryByType(req.params.type);
        res.status(200).json(response);
    });

    // GET /api/v1/inventory/low-stock
    getLowStockItems = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.getLowStockItems();
        res.status(200).json(response);
    });

    // GET /api/v1/inventory/out-of-stock
    getOutOfStockItems = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.getOutOfStockItems();
        res.status(200).json(response);
    });

    // GET /api/v1/inventory/statistics
    getStatistics = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.getStatistics();
        res.status(200).json(response);
    });

    // GET /api/v1/inventory/:itemId
    getInventoryById = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.getInventoryById(req.params.itemId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PUT /api/v1/inventory/:itemId
    updateInventoryItem = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.updateInventoryItem(req.params.itemId, req.body);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PATCH /api/v1/inventory/:itemId/stock
    updateStock = asyncTryCatch(async (req, res, next) => {
        const { quantity, operation } = req.body;
        const response = await inventoryService.updateStock(req.params.itemId, quantity, operation);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // DELETE /api/v1/inventory/:itemId
    deleteInventoryItem = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryService.deleteInventoryItem(req.params.itemId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });
}

module.exports = new InventoryController();