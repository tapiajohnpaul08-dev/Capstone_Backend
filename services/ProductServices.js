const Product = require('../models/Product.Model');
const generateId = require('../utils/generateItemId');

const InventoryItemService = require('./InventoryItemServices');

const fs = require('fs');
const path = require('path');

class ProductService {

    // ─────────────────────────────────────────
    // CREATE PRODUCT
    // ─────────────────────────────────────────
  async createProduct(payload, imageFile = null) {
        try {
            const existingProduct = await Product.findOne({ 
                $or: [
                    { id: payload.id },
                    { name: payload.name }
                ]
            });

            if (existingProduct) {
                return {
                    success: false,
                    message: 'A product with this ID or name already exists'
                };
            }

            const productId = await generateId('PRD', 3);
            
            // Handle image URL or uploaded file
            let imagePath = '';
            if (imageFile) {
                // Save image path relative to public directory
                imagePath = `/uploads/products/${imageFile.filename}`;
            } else if (payload.image) {
                imagePath = payload.image;
            } else {
                imagePath = '/uploads/products/default-product.jpg';
            }
            
            // Parse sizes if coming as JSON string
            let sizes = payload.sizes;
            if (typeof sizes === 'string') {
                sizes = JSON.parse(sizes);
            }
            
            const processedSizes = (sizes || []).map(size => ({
                name: size.name,
                price: size.price,
                stock: size.stock || 0,
                bulkPrices: size.bulkPrices || {}
            }));
            
            const newProduct = new Product({
                id: productId,
                name: payload.name,
                category: payload.category,
                subcategory: payload.subcategory,
                image: imagePath,
                sizes: processedSizes,
                minOrder: payload.minOrder || 500,
                featured: payload.featured === 'true' || payload.featured === true,
                popular: payload.popular === 'true' || payload.popular === true,
                description: payload.description || ''
            });

            await newProduct.save();

           // ✅ Auto-add to inventory
await InventoryItemService.addProductToInventory(productId, {
    stock: 0,
    unit: 'piece',
    threshold: 100,
    unitCost: processedSizes[0]?.price || 0,
    location: 'Warehouse A'
});

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
    // GET ALL PRODUCTS
    // ─────────────────────────────────────────
    async getAllProducts() {
        try {
            const products = await Product.find().sort({ id: 1 });
            return { success: true, data: products };
        } catch (error) {
            console.error('Error fetching products:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET PRODUCT BY ID
    // ─────────────────────────────────────────
    async getProductById(id) {
        try {
            const product = await Product.findOne({ id });
            console.log('pr-id:', id);
             
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
    // UPDATE PRODUCT (Basic Info)
    // ─────────────────────────────────────────
async updateProduct(id, payload, imageFile = null) {
        try {
            const { id: _id, sizes, ...updateData } = payload;
            updateData.updatedAt = new Date();

            // Handle image update
            if (imageFile) {
                // Delete old image if exists
                const oldProduct = await Product.findOne({ id });
                if (oldProduct && oldProduct.image && oldProduct.image !== '/uploads/products/default-product.jpg') {
                    const oldImagePath = path.join(__dirname, '..', oldProduct.image);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
                updateData.image = `/uploads/products/${imageFile.filename}`;
            }

            if (sizes) {
                let parsedSizes = sizes;
                if (typeof sizes === 'string') {
                    parsedSizes = JSON.parse(sizes);
                }
                const processedSizes = parsedSizes.map(size => ({
                    name: size.name,
                    price: size.price,
                    stock: size.stock || 0,
                    bulkPrices: size.bulkPrices || {}
                }));
                updateData.sizes = processedSizes;
            }

            const product = await Product.findOneAndUpdate(
                { id },
                updateData,
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
    // DELETE PRODUCT
    // ─────────────────────────────────────────
    async deleteProduct(id) {
        try {
            const product = await Product.findOne({ id });
            
            if (!product) {
                return { success: false, message: 'Product not found' };
            }
            
            // Delete associated image
            if (product.image && product.image !== '/uploads/products/default-product.jpg') {
                const imagePath = path.join(__dirname, '..', product.image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }
            
            await Product.findOneAndDelete({ id });
            
            return { success: true, message: 'Product deleted successfully' };
        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // VALIDATE SIZE DATA (Helper)
    // ─────────────────────────────────────────
    validateSizeData(size) {
        if (!size.name) {
            return { valid: false, message: 'Size name is required' };
        }
        if (!size.price || size.price <= 0) {
            return { valid: false, message: `Valid price is required for size "${size.name}"` };
        }

        // Validate bulk prices
        if (size.bulkPrices) {
            const validQuantities = [500, 1000, 2000, 5000];
            for (const qty of validQuantities) {
                if (size.bulkPrices[qty] !== undefined && size.bulkPrices[qty] !== null) {
                    const unitTotal = size.price * qty;
                    if (size.bulkPrices[qty] < unitTotal) {
                        return {
                            valid: false,
                            message: `Bulk price for ${qty} pcs (₱${size.bulkPrices[qty]}) cannot be less than unit price total (₱${unitTotal})`
                        };
                    }
                }
            }
        }

        return { valid: true };
    }

    // ==========================================
    // SIZE MANAGEMENT METHODS
    // ==========================================

    // ─────────────────────────────────────────
    // ADD SIZE TO PRODUCT
    // ─────────────────────────────────────────
    async addSize(productId, sizeData) {
        try {
            const product = await Product.findOne({ id: productId });
            
            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            // Check if size already exists
            const sizeExists = product.sizes.some(s => s.name === sizeData.name);
            if (sizeExists) {
                return { 
                    success: false, 
                    message: `Size "${sizeData.name}" already exists for this product` 
                };
            }

            // // Validate size data
            // const validation = this.validateSizeData(sizeData);
            // if (!validation.valid) {
            //     return { success: false, message: validation.message };
            // }

            // Add new size
            product.sizes.push({
                name: sizeData.name,
                price: sizeData.price,
                bulkPrices: sizeData.bulkPrices || {}
            });
            
            product.updatedAt = new Date();
            await product.save();

            return {
                success: true,
                message: `Size "${sizeData.name}" added successfully`,
                data: product
            };

        } catch (error) {
            console.error('Error adding size:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE SIZE
    // ─────────────────────────────────────────
    async updateSize(productId, sizeName, sizeData) {
        try {
            const product = await Product.findOne({ id: productId });
            
            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            // Find the size index
            const sizeIndex = product.sizes.findIndex(s => s.name === sizeName);
            if (sizeIndex === -1) {
                return { success: false, message: `Size "${sizeName}" not found` };
            }

            // Validate updated size data
            const updatedSize = {
                name: sizeData.name || sizeName,
                price: sizeData.price !== undefined ? sizeData.price : product.sizes[sizeIndex].price,
                bulkPrices: sizeData.bulkPrices || product.sizes[sizeIndex].bulkPrices || {}
            };

            // const validation = this.validateSizeData(updatedSize);
            // if (!validation.valid) {
            //     return { success: false, message: validation.message };
            // }

            // Check if new name conflicts with another size
            if (sizeData.name && sizeData.name !== sizeName) {
                const nameExists = product.sizes.some(s => s.name === sizeData.name);
                if (nameExists) {
                    return { 
                        success: false, 
                        message: `Size "${sizeData.name}" already exists` 
                    };
                }
            }

            // Update the size
            product.sizes[sizeIndex] = updatedSize;
            product.updatedAt = new Date();
            await product.save();

            return {
                success: true,
                message: `Size "${sizeName}" updated successfully`,
                data: product
            };

        } catch (error) {
            console.error('Error updating size:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // REMOVE SIZE FROM PRODUCT
    // ─────────────────────────────────────────
    async removeSize(productId, sizeName) {
        try {
            const product = await Product.findOne({ id: productId });
            
            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            const sizeExists = product.sizes.some(s => s.name === sizeName);
            if (!sizeExists) {
                return { success: false, message: `Size "${sizeName}" not found` };
            }

            product.sizes = product.sizes.filter(s => s.name !== sizeName);
            product.updatedAt = new Date();
            await product.save();

            return {
                success: true,
                message: `Size "${sizeName}" removed successfully`,
                data: product
            };

        } catch (error) {
            console.error('Error removing size:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE BULK PRICES FOR A SIZE
    // ─────────────────────────────────────────
    async updateBulkPrices(productId, sizeName, bulkPrices) {
        try {
            const product = await Product.findOne({ id: productId });
            
            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            const sizeIndex = product.sizes.findIndex(s => s.name === sizeName);
            if (sizeIndex === -1) {
                return { success: false, message: `Size "${sizeName}" not found` };
            }

            const size = product.sizes[sizeIndex];
            const validQuantities = [500, 1000, 2000, 5000];
            
            // // Validate each bulk price
            // for (const qty of validQuantities) {
            //     if (bulkPrices[qty] !== undefined && bulkPrices[qty] !== null) {
            //         const unitTotal = size.price * qty;
            //         if (bulkPrices[qty] < unitTotal) {
            //             return {
            //                 success: false,
            //                 message: `Bulk price for ${qty} pcs (₱${bulkPrices[qty]}) cannot be less than unit price total (₱${unitTotal})`
            //             };
            //         }
            //     }
            // }

            // Update bulk prices
            product.sizes[sizeIndex].bulkPrices = {
                ...product.sizes[sizeIndex].bulkPrices,
                ...bulkPrices
            };
            
            product.updatedAt = new Date();
            await product.save();

            return {
                success: true,
                message: `Bulk prices for "${sizeName}" updated successfully`,
                data: product
            };

        } catch (error) {
            console.error('Error updating bulk prices:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET SIZE DETAILS
    // ─────────────────────────────────────────
    async getSizeDetails(productId, sizeName) {
        try {
            const product = await Product.findOne({ id: productId });
            
            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            const size = product.sizes.find(s => s.name === sizeName);
            if (!size) {
                return { success: false, message: `Size "${sizeName}" not found` };
            }

            return {
                success: true,
                data: {
                    name: size.name,
                    price: size.price,
                    bulkPrices: size.bulkPrices,
                    unitPriceBreakdown: {
                        '500': size.bulkPrices?.[500] ? size.bulkPrices[500] / 500 : size.price,
                        '1000': size.bulkPrices?.[1000] ? size.bulkPrices[1000] / 1000 : size.price,
                        '2000': size.bulkPrices?.[2000] ? size.bulkPrices[2000] / 2000 : size.price,
                        '5000': size.bulkPrices?.[5000] ? size.bulkPrices[5000] / 5000 : size.price
                    }
                }
            };

        } catch (error) {
            console.error('Error getting size details:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ALL SIZES FOR A PRODUCT
    // ─────────────────────────────────────────
    async getAllSizes(productId) {
        try {
            const product = await Product.findOne({ id: productId });
            
            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            return {
                success: true,
                data: product.sizes.map(size => ({
                    name: size.name,
                    price: size.price,
                    bulkPrices: size.bulkPrices,
                    minOrder: product.minOrder
                }))
            };

        } catch (error) {
            console.error('Error getting all sizes:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET PRODUCTS BY CATEGORY
    // ─────────────────────────────────────────
    async getProductsByCategory(category) {
        try {
            const products = await Product.find({ category });
            return { success: true, data: products };
        } catch (error) {
            console.error('Error fetching products by category:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE STOCK STATUS
    // ─────────────────────────────────────────
    async updateStockStatus(id, inStock) {
        try {
            const product = await Product.findOneAndUpdate(
                { id },
                { inStock, updatedAt: new Date() },
                { new: true }
            );

            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            return {
                success: true,
                message: `Product ${inStock ? 'in stock' : 'out of stock'}`,
                data: product
            };
        } catch (error) {
            console.error('Error updating stock status:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET FEATURED PRODUCTS
    // ─────────────────────────────────────────
    async getFeaturedProducts() {
        try {
            const products = await Product.find({ featured: true, inStock: true }).sort({ popularity: -1 });
            return { success: true, data: products };
        } catch (error) {
            console.error('Error fetching featured products:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET POPULAR PRODUCTS
    // ─────────────────────────────────────────
    async getPopularProducts() {
        try {
            const products = await Product.find({ popular: true, inStock: true }).sort({ popularity: -1 });
            return { success: true, data: products };
        } catch (error) {
            console.error('Error fetching popular products:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // CALCULATE PRICE FOR QUANTITY
    // ─────────────────────────────────────────
    async calculatePrice(productId, sizeName, quantity) {
        try {
            const product = await Product.findOne({ id: productId });
            if (!product) return null;
            
            const size = product.sizes.find(s => s.name === sizeName);
            if (!size) return null;
            
            let unitPrice = size.price;
            
            if (quantity >= 5000 && size.bulkPrices?.[5000]) {
                unitPrice = size.bulkPrices[5000] / 5000;
            } else if (quantity >= 2000 && size.bulkPrices?.[2000]) {
                unitPrice = size.bulkPrices[2000] / 2000;
            } else if (quantity >= 1000 && size.bulkPrices?.[1000]) {
                unitPrice = size.bulkPrices[1000] / 1000;
            } else if (quantity >= 500 && size.bulkPrices?.[500]) {
                unitPrice = size.bulkPrices[500] / 500;
            }
            
            return unitPrice * quantity;
        } catch (error) {
            console.error('Error calculating price:', error);
            throw error;
        }
    }

async updateSizeStock(productId, sizeName, stock) {
    try {
        console.log('productID', productId)
        const product = await Product.findOne({ id: productId });
        
        if (!product) {
            return { success: false, message: 'Product not found' };
        }
        
        // Find the size index
        const sizeIndex = product.sizes.findIndex(s => s.name === sizeName);
        if (sizeIndex === -1) {
            return { success: false, message: `Size "${sizeName}" not found` };
        }
        
        // Update the stock directly
        product.sizes[sizeIndex].stock = Math.max(0, stock);
        product.updatedAt = new Date();
        
        await product.save();
        
        return {
            success: true,
            message: `Stock updated for size "${sizeName}"`,
            data: product
        };
    } catch (error) {
        console.error('Error updating size stock:', error);
        throw error;
    }
}

// Reduce stock for a specific size
async reduceStock(productId, sizeName, quantity) {
    try {
        const product = await Product.findOne({ id: productId });
        if (!product) {
            return { success: false, message: 'Product not found' };
        }
        
        // Find the size index
        const sizeIndex = product.sizes.findIndex(s => s.name === sizeName);
        if (sizeIndex === -1) {
            return { success: false, message: `Size "${sizeName}" not found` };
        }
        
        const currentStock = product.sizes[sizeIndex].stock || 0;
        if (currentStock < quantity) {
            return { 
                success: false, 
                message: `Insufficient stock for size "${sizeName}". Available: ${currentStock}, Requested: ${quantity}`
            };
        }
        
        // Reduce the stock
        product.sizes[sizeIndex].stock = currentStock - quantity;
        product.updatedAt = new Date();
        
        await product.save();
        
        return {
            success: true,
            message: `Stock reduced by ${quantity} for size "${sizeName}"`,
            data: product
        };
    } catch (error) {
        console.error('Error reducing stock:', error);
        throw error;
    }
}
}

module.exports = new ProductService();