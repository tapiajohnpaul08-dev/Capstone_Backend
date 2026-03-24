const Product = require('../models/Product_Model');
const generateId = require('../utils/generateId');

class ProductService {

    // ─────────────────────────────────────────
    // CREATE
    // ─────────────────────────────────────────
    async createProduct(payload) {
        try {
            const existingProduct = await Product.findOne({
                $or: [
                    { productId: payload.productId },
                    { name: payload.name, category: payload.category }
                ]
            });

            if (existingProduct) {
                return {
                    success: false,
                    message: 'A product with this name already exists in the same category'
                };
            }

            const newProduct = new Product({
                productId:   await generateId(),
                name:        payload.name,
                description: payload.description,
                category:    payload.category,
                sizes:       payload.sizes,   // [{ label, perPiece, qty500, qty1000, qty2000, qty5000 }]
            });

            await newProduct.save();

            return {
                success: true,
                message: 'Product created successfully',
                data: newProduct
            };

        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ALL
    // ─────────────────────────────────────────
    async getAllProducts() {
        try {
            const products = await Product.find();
            return { success: true, data: products };
        } catch (error) {
            console.error('Error fetching products:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET BY ID
    // ─────────────────────────────────────────
    async getProductById(productId) {
        try {
            const product = await Product.findOne({ productId });

            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            return { success: true, data: product };
        } catch (error) {
            console.error('Error fetching product:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET BY CATEGORY
    // ─────────────────────────────────────────
    async getProductsByCategory(category) {
        try {
            const products = await Product.find({ category });

            if (!products.length) {
                return { success: false, message: 'No products found in this category' };
            }

            return { success: true, data: products };
        } catch (error) {
            console.error('Error fetching products by category:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET PRICE FOR SIZE + QUANTITY
    // ─────────────────────────────────────────
    async getPrice(productId, sizeLabel, quantity) {
        try {
            const product = await Product.findOne({ productId });

            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            const sizeEntry = product.sizes.find(
                s => s.label.toLowerCase() === sizeLabel.toLowerCase()
            );

            if (!sizeEntry) {
                return { success: false, message: `Size "${sizeLabel}" not found for this product` };
            }

            const { perPiece, qty500, qty1000, qty2000, qty5000 } = sizeEntry;

            let price;
            if      (quantity >= 5000) price = qty5000;
            else if (quantity >= 2000) price = qty2000;
            else if (quantity >= 1000) price = qty1000;
            else if (quantity >= 500)  price = qty500;
            else                       price = perPiece * quantity;

            return {
                success: true,
                data: {
                    productId,
                    sizeLabel,
                    quantity,
                    totalPrice: price
                }
            };

        } catch (error) {
            console.error('Error getting price:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE PRODUCT
    // ─────────────────────────────────────────
    async updateProduct(productId, payload) {
        try {
            // Prevent overwriting productId
            const { productId: _id, ...safePayload } = payload;

            const product = await Product.findOneAndUpdate(
                { productId },
                safePayload,
                { new: true, runValidators: true }
            );

            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            return {
                success: true,
                message: 'Product updated successfully',
                data: product
            };

        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE SIZE PRICES
    // ─────────────────────────────────────────
    async updateSizePrice(productId, sizeLabel, newPrices) {
        try {
            const product = await Product.findOne({ productId });

            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            const sizeIndex = product.sizes.findIndex(
                s => s.label.toLowerCase() === sizeLabel.toLowerCase()
            );

            if (sizeIndex === -1) {
                return { success: false, message: `Size "${sizeLabel}" not found` };
            }

            // Merge new prices into existing size entry
            product.sizes[sizeIndex] = {
                ...product.sizes[sizeIndex].toObject(),
                ...newPrices
            };

            await product.save();

            return {
                success: true,
                message: `Prices for ${sizeLabel} updated successfully`,
                data: product
            };

        } catch (error) {
            console.error('Error updating size price:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────────
    async deleteProduct(productId) {
        try {
            const product = await Product.findOneAndDelete({ productId });

            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            return { success: true, message: 'Product deleted successfully' };

        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    }
}

module.exports = new ProductService();