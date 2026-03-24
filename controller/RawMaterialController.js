const rawMaterialService = require('../services/RawMaterialServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class RawMaterialController {

    // POST /api/v1/material
    createRawMaterial = asyncTryCatch(async (req, res, next) => {
        const response = await rawMaterialService.createRawMaterial(req.body);
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // GET /api/v1/material
    getAllRawMaterials = asyncTryCatch(async (req, res, next) => {
        const response = await rawMaterialService.getAllRawMaterials();
        res.status(200).json(response);
    });

    // GET /api/v1/material/low-stock
    getLowStockMaterials = asyncTryCatch(async (req, res, next) => {
        const response = await rawMaterialService.getLowStockMaterials();
        res.status(200).json(response);
    });

    // GET /api/v1/material/category/:category
    getRawMaterialsByCategory = asyncTryCatch(async (req, res, next) => {
        const response = await rawMaterialService.getRawMaterialsByCategory(req.params.category);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // GET /api/v1/material/:materialId
    getRawMaterialById = asyncTryCatch(async (req, res, next) => {
        const response = await rawMaterialService.getRawMaterialById(req.params.materialId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PATCH /api/v1/material/:materialId/add
    addStock = asyncTryCatch(async (req, res, next) => {
        const response = await rawMaterialService.addStock(
            req.params.materialId,
            Number(req.body.quantity)
        );
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // PATCH /api/v1/material/:materialId/deduct
    deductStock = asyncTryCatch(async (req, res, next) => {
        const response = await rawMaterialService.deductStock(
            req.params.materialId,
            Number(req.body.quantity)
        );
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // PUT /api/v1/material/:materialId
    updateRawMaterial = asyncTryCatch(async (req, res, next) => {
        const response = await rawMaterialService.updateRawMaterial(req.params.materialId, req.body);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // DELETE /api/v1/material/:materialId
    deleteRawMaterial = asyncTryCatch(async (req, res, next) => {
        const response = await rawMaterialService.deleteRawMaterial(req.params.materialId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });
}

module.exports = new RawMaterialController();