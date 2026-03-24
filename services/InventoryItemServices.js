const InventoryItem = require('../models/InventoryItem_Model');
const Product = require('../models/Product_Model');
const generateId = require('../utils/generateId');

class InventoryItemService {

    // ─────────────────────────────────────────
    // CREATE
    // ─────────────────────────────────────────
    async createInventoryItem(payload) {
        try {
            // Validate product exists
            const product = await Product.findOne({ productId: payload.productId });

            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            // Validate sizeLabel exists on the product
            const sizeExists = product.sizes.some(
                s => s.label.toLowerCase() === payload.sizeLabel.toLowerCase()
            );

            if (!sizeExists) {
                return {
                    success: false,
                    message: `Size "${payload.sizeLabel}" does not exist on this product`
                };
            }

            // Prevent duplicate inventory entry for same product + size
            const existingItem = await InventoryItem.findOne({
                product:   product._id,
                sizeLabel: payload.sizeLabel
            });

            if (existingItem) {
                return {
                    success: false,
                    message: `Inventory for ${product.name} - ${payload.sizeLabel} already exists`
                };
            }

            const newItem = new InventoryItem({
                inventoryId:       await generateId(),
                product:           product._id,
                sizeLabel:         payload.sizeLabel,
                unit:              payload.unit,
                stock:             payload.stock || 0,
                lowStockThreshold: payload.lowStockThreshold || 500,
            });

            await newItem.save();
            await newItem.populate('product', 'name category sizes');

            return {
                success: true,
                message: 'Inventory item created successfully',
                data: newItem
            };

        } catch (error) {
            console.error('Error creating inventory item:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ALL
    // ─────────────────────────────────────────
    async getAllInventoryItems() {
        try {
            const items = await InventoryItem.find()
                .populate('product', 'name category sizes');

            return { success: true, data: items };
        } catch (error) {
            console.error('Error fetching inventory items:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET BY ID
    // ─────────────────────────────────────────
    async getInventoryItemById(inventoryId) {
        try {
            const item = await InventoryItem.findOne({ inventoryId })
                .populate('product', 'name category sizes');

            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }

            return { success: true, data: item };
        } catch (error) {
            console.error('Error fetching inventory item:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET BY PRODUCT
    // ─────────────────────────────────────────
    async getInventoryByProduct(productId) {
        try {
            const product = await Product.findOne({ productId });

            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            const items = await InventoryItem.find({ product: product._id })
                .populate('product', 'name category sizes');

            return { success: true, data: items };
        } catch (error) {
            console.error('Error fetching inventory by product:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET LOW STOCK ITEMS
    // ─────────────────────────────────────────
    async getLowStockItems() {
        try {
            const items = await InventoryItem.find({
                $expr: { $lte: ['$stock', '$lowStockThreshold'] }
            }).populate('product', 'name category');

            return { success: true, data: items };
        } catch (error) {
            console.error('Error fetching low stock items:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // ADD STOCK
    // ─────────────────────────────────────────
    async addStock(inventoryId, quantity) {
        try {
            if (quantity <= 0) {
                return { success: false, message: 'Quantity must be greater than 0' };
            }

            const item = await InventoryItem.findOne({ inventoryId });

            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }

            item.stock += quantity;
            await item.save();

            return {
                success: true,
                message: `Added ${quantity} units to stock`,
                data: item
            };

        } catch (error) {
            console.error('Error adding stock:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DEDUCT STOCK
    // ─────────────────────────────────────────
    async deductStock(inventoryId, quantity) {
        try {
            if (quantity <= 0) {
                return { success: false, message: 'Quantity must be greater than 0' };
            }

            const item = await InventoryItem.findOne({ inventoryId });

            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }

            if (item.stock < quantity) {
                return {
                    success: false,
                    message: `Insufficient stock. Available: ${item.stock}, Requested: ${quantity}`
                };
            }

            item.stock -= quantity;
            await item.save();

            return {
                success: true,
                message: `Deducted ${quantity} units from stock`,
                data: item
            };

        } catch (error) {
            console.error('Error deducting stock:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE
    // ─────────────────────────────────────────
    async updateInventoryItem(inventoryId, payload) {
        try {
            // Prevent overwriting inventoryId or product ref
            const { inventoryId: _id, product, ...safePayload } = payload;

            const item = await InventoryItem.findOneAndUpdate(
                { inventoryId },
                safePayload,
                { new: true, runValidators: true }
            ).populate('product', 'name category sizes');

            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }

            return {
                success: true,
                message: 'Inventory item updated successfully',
                data: item
            };

        } catch (error) {
            console.error('Error updating inventory item:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────────
    async deleteInventoryItem(inventoryId) {
        try {
            const item = await InventoryItem.findOneAndDelete({ inventoryId });

            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }

            return { success: true, message: 'Inventory item deleted successfully' };

        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    }
}

module.exports = new InventoryItemService();