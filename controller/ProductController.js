const productService = require('../services/ProductServices');
const asyncTryCatch = require('../utils/tryAndCatch');
const upload = require('../middleware/upload');

class ProductController {

    // ========== PRODUCT CRUD ==========
    
    // POST /api/v1/product
    createProduct = [
        upload.single('image'),
        asyncTryCatch(async (req, res, next) => {
            const response = await productService.createProduct(req.body, req.file);
            const status = response.success ? 201 : 400;
            res.status(status).json(response);
        })
    ];

    // GET /api/v1/product
    getAllProducts = asyncTryCatch(async (req, res, next) => {
        const response = await productService.getAllProducts();
        res.status(200).json(response);
    });

    // GET /api/v1/product/featured
    getFeaturedProducts = asyncTryCatch(async (req, res, next) => {
        const response = await productService.getFeaturedProducts();
        res.status(200).json(response);
    });

    // GET /api/v1/product/popular
    getPopularProducts = asyncTryCatch(async (req, res, next) => {
        const response = await productService.getPopularProducts();
        res.status(200).json(response);
    });

    // GET /api/v1/product/category/:category
    getProductsByCategory = asyncTryCatch(async (req, res, next) => {
        const response = await productService.getProductsByCategory(req.params.category);
        res.status(200).json(response);
    });

    // GET /api/v1/product/:id
    getProductById = asyncTryCatch(async (req, res, next) => {
        const id = req.params.id;
        console.log('Controller - getProductById called with id:', id);
        const response = await productService.getProductById(id);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PUT /api/v1/product/:id
   updateProduct = [
        upload.single('image'),
        asyncTryCatch(async (req, res, next) => {
            const { id } = req.params;
            const response = await productService.updateProduct(id, req.body, req.file);
            const status = response.success ? 200 : 404;
            res.status(status).json(response);
        })
    ];

    // DELETE /api/v1/product/:id
    async deleteProduct(req, res) {
    try {
        const { id } = req.params;
        
        const result = await productService.deleteProduct(id);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error('Error in deleteProduct:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

    // PATCH /api/v1/product/:id/stock
    updateStockStatus = asyncTryCatch(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const { inStock } = req.body;
        const response = await productService.updateStockStatus(id, inStock);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // ========== SIZE MANAGEMENT ==========

    // POST /api/v1/product/:id/size
    addSize = asyncTryCatch(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const response = await productService.addSize(id, req.body);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // PUT /api/v1/product/:id/size/:sizeName
    updateSize = asyncTryCatch(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const { sizeName } = req.params;
        const response = await productService.updateSize(id, sizeName, req.body);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // DELETE /api/v1/product/:id/size/:sizeName
    removeSize = asyncTryCatch(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const { sizeName } = req.params;
        const response = await productService.removeSize(id, sizeName);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // PATCH /api/v1/product/:id/size/:sizeName/bulk-prices
    updateBulkPrices = asyncTryCatch(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const { sizeName } = req.params;
        const { bulkPrices } = req.body;
        const response = await productService.updateBulkPrices(id, sizeName, bulkPrices);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // GET /api/v1/product/:id/size/:sizeName
    getSizeDetails = asyncTryCatch(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const { sizeName } = req.params;
        const response = await productService.getSizeDetails(id, sizeName);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // GET /api/v1/product/:id/sizes
    getAllSizes = asyncTryCatch(async (req, res, next) => {
        const id = parseInt(req.params.id);
        const response = await productService.getAllSizes(id);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // POST /api/v1/product/calculate-price
    calculatePrice = asyncTryCatch(async (req, res, next) => {
        const { productId, sizeName, quantity } = req.body;
        const total = await productService.calculatePrice(productId, sizeName, quantity);
        res.status(200).json({
            success: true,
            data: {
                total: total,
                unitPrice: total ? total / quantity : null,
                quantity: quantity
            }
        });
    });

    // PATCH /api/v1/product/:id/size/:sizeName/stock
updateSizeStock = asyncTryCatch(async (req, res, next) => {
    const { id, sizeName } = req.params;
    const { stock } = req.body;
    const response = await productService.updateSizeStock(id, sizeName, stock);
    const status = response.success ? 200 : 404;
    res.status(status).json(response);
});

// POST /api/v1/product/:id/size/:sizeName/reduce-stock
reduceStock = asyncTryCatch(async (req, res, next) => {
    const { id, sizeName } = req.params;
    const { quantity } = req.body;
    const response = await productService.reduceStock(id, sizeName, quantity);
    const status = response.success ? 200 : 400;
    res.status(status).json(response);
});
}

module.exports = new ProductController();