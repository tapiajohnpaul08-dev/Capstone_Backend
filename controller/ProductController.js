const productService = require('../services/ProductServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class ProductController {

    // POST /api/v1/product
    createProduct = asyncTryCatch(async (req, res, next) => {
        const response = await productService.createProduct(req.body);
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // GET /api/v1/product
    getAllProducts = asyncTryCatch(async (req, res, next) => {
        const response = await productService.getAllProducts();
        res.status(200).json(response);
    });

    // GET /api/v1/product/:productId
    getProductById = asyncTryCatch(async (req, res, next) => {
        const response = await productService.getProductById(req.params.productId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // GET /api/v1/product/category/:category
    getProductsByCategory = asyncTryCatch(async (req, res, next) => {
        const response = await productService.getProductsByCategory(req.params.category);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // GET /api/v1/product/:productId/price?sizeLabel=12oz&quantity=1000
    getPrice = asyncTryCatch(async (req, res, next) => {
        const { sizeLabel, quantity } = req.query;
        const response = await productService.getPrice(
            req.params.productId,
            sizeLabel,
            Number(quantity)
        );
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PUT /api/v1/product/:productId
    updateProduct = asyncTryCatch(async (req, res, next) => {
        const response = await productService.updateProduct(req.params.productId, req.body);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PUT /api/v1/product/:productId/size
    updateSizePrice = asyncTryCatch(async (req, res, next) => {
        const { sizeLabel, ...newPrices } = req.body;
        const response = await productService.updateSizePrice(
            req.params.productId,
            sizeLabel,
            newPrices
        );
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // DELETE /api/v1/product/:productId
    deleteProduct = asyncTryCatch(async (req, res, next) => {
        const response = await productService.deleteProduct(req.params.productId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });
}

module.exports = new ProductController();