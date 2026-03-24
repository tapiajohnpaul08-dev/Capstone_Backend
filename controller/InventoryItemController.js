const inventoryItemService = require('../services/InventoryItemServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class InventoryItemController {

    // POST /api/v1/inventory
    createInventoryItem = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryItemService.createInventoryItem(req.body);
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // GET /api/v1/inventory
    getAllInventoryItems = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryItemService.getAllInventoryItems();
        res.status(200).json(response);
    });

    // GET /api/v1/inventory/low-stock
    getLowStockItems = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryItemService.getLowStockItems();
        res.status(200).json(response);
    });

    // GET /api/v1/inventory/:inventoryId
    getInventoryItemById = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryItemService.getInventoryItemById(req.params.inventoryId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // GET /api/v1/inventory/product/:productId
    getInventoryByProduct = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryItemService.getInventoryByProduct(req.params.productId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PATCH /api/v1/inventory/:inventoryId/add
    addStock = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryItemService.addStock(
            req.params.inventoryId,
            Number(req.body.quantity)
        );
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // PATCH /api/v1/inventory/:inventoryId/deduct
    deductStock = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryItemService.deductStock(
            req.params.inventoryId,
            Number(req.body.quantity)
        );
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // PUT /api/v1/inventory/:inventoryId
    updateInventoryItem = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryItemService.updateInventoryItem(req.params.inventoryId, req.body);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // DELETE /api/v1/inventory/:inventoryId
    deleteInventoryItem = asyncTryCatch(async (req, res, next) => {
        const response = await inventoryItemService.deleteInventoryItem(req.params.inventoryId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });
}

module.exports = new InventoryItemController();