// services/InventoryItemServices.js
const InventoryItem = require('../models/InventoryItem.Model');
const Product = require('../models/Product.Model');
const RawMaterial = require('../models/RawMaterial.Model');
const generateId = require('../utils/generateId');

class InventoryItemService {

    // ─────────────────────────────────────────
    // CREATE
    // ─────────────────────────────────────────
    async createInventoryItem(payload) {
        try {
            const { itemType, itemIdentifier, sizeLabel, ...rest } = payload;
            
            let item;
            let itemDoc;
            let finalItemType;
            let finalSizeLabel = sizeLabel;

            if (itemType === 'product') {
                // Validate product exists
                itemDoc = await Product.findOne({ productId: itemIdentifier });
                if (!itemDoc) {
                    return { success: false, message: 'Product not found' };
                }

                // Validate sizeLabel exists on the product
                if (!sizeLabel) {
                    return { success: false, message: 'Size label is required for products' };
                }

                const sizeExists = itemDoc.sizes.some(
                    s => s.label.toLowerCase() === sizeLabel.toLowerCase()
                );

                if (!sizeExists) {
                    return {
                        success: false,
                        message: `Size "${sizeLabel}" does not exist on this product`
                    };
                }

                // Check for duplicate inventory entry
                const existingItem = await InventoryItem.findOne({
                    item: itemDoc._id,
                    itemType: 'Product',
                    sizeLabel: sizeLabel
                });

                if (existingItem) {
                    return {
                        success: false,
                        message: `Inventory for ${itemDoc.name} - ${sizeLabel} already exists`
                    };
                }

                item = itemDoc._id;
                finalItemType = 'Product';

            } else if (itemType === 'rawMaterial') {
                // Validate raw material exists
                itemDoc = await RawMaterial.findOne({ materialId: itemIdentifier });
                if (!itemDoc) {
                    return { success: false, message: 'Raw material not found' };
                }

                // Check for duplicate inventory entry
                const existingItem = await InventoryItem.findOne({
                    item: itemDoc._id,
                    itemType: 'RawMaterial'
                });

                if (existingItem) {
                    return {
                        success: false,
                        message: `Inventory for ${itemDoc.name} already exists`
                    };
                }

                item = itemDoc._id;
                finalItemType = 'RawMaterial';
                finalSizeLabel = undefined; // Raw materials don't have size

            } else {
                return { success: false, message: 'Invalid item type. Must be "product" or "rawMaterial"' };
            }

            const newItem = new InventoryItem({
                inventoryId: await generateId(),
                itemType: finalItemType,
                item: item,
                sizeLabel: finalSizeLabel,
                unit: rest.unit,
                stock: rest.stock || 0,
                lowStockThreshold: rest.lowStockThreshold || (itemType === 'rawMaterial' ? 10 : 500),
                notes: rest.notes,
                location: rest.location,
                lastRestocked: rest.stock ? new Date() : undefined
            });

            await newItem.save();
            
            // Populate based on item type
            await newItem.populate('item');

            return {
                success: true,
                message: `Inventory item created successfully for ${itemDoc.name}`,
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
    async getAllInventoryItems(filters = {}) {
        try {
            const query = {};
            
            // Apply filters if provided
            if (filters.itemType) {
                query.itemType = filters.itemType === 'product' ? 'Product' : 'RawMaterial';
            }
            if (filters.lowStock === 'true') {
                query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
            }
            if (filters.location) {
                query.location = filters.location;
            }

            const items = await InventoryItem.find(query)
                .populate('item')
                .sort({ createdAt: -1 });

            // Transform response to include type information
            const transformedItems = items.map(item => ({
                ...item.toObject(),
                itemType: item.itemType === 'Product' ? 'product' : 'rawMaterial',
                itemName: item.item?.name || item.item?.productId || item.item?.materialId,
                itemCategory: item.item?.category
            }));

            return { success: true, data: transformedItems };
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
                .populate('item');

            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }

            const transformedItem = {
                ...item.toObject(),
                itemType: item.itemType === 'Product' ? 'product' : 'rawMaterial',
                itemName: item.item?.name || item.item?.productId || item.item?.materialId,
                itemCategory: item.item?.category
            };

            return { success: true, data: transformedItem };
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

            const items = await InventoryItem.find({ 
                item: product._id, 
                itemType: 'Product' 
            }).populate('item');

            const transformedItems = items.map(item => ({
                ...item.toObject(),
                itemType: 'product',
                itemName: item.item?.name
            }));

            return { success: true, data: transformedItems };
        } catch (error) {
            console.error('Error fetching inventory by product:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET BY RAW MATERIAL
    // ─────────────────────────────────────────
    async getInventoryByRawMaterial(materialId) {
        try {
            const rawMaterial = await RawMaterial.findOne({ materialId });
            if (!rawMaterial) {
                return { success: false, message: 'Raw material not found' };
            }

            const items = await InventoryItem.find({ 
                item: rawMaterial._id, 
                itemType: 'RawMaterial' 
            }).populate('item');

            const transformedItems = items.map(item => ({
                ...item.toObject(),
                itemType: 'rawMaterial',
                itemName: item.item?.name
            }));

            return { success: true, data: transformedItems };
        } catch (error) {
            console.error('Error fetching inventory by raw material:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET LOW STOCK ITEMS
    // ─────────────────────────────────────────
    async getLowStockItems(itemType = null) {
        try {
            const query = {
                $expr: { $lte: ['$stock', '$lowStockThreshold'] }
            };
            
            if (itemType) {
                query.itemType = itemType === 'product' ? 'Product' : 'RawMaterial';
            }
            
            const items = await InventoryItem.find(query).populate('item');

            const transformedItems = items.map(item => ({
                ...item.toObject(),
                itemType: item.itemType === 'Product' ? 'product' : 'rawMaterial',
                itemName: item.item?.name || item.item?.productId || item.item?.materialId,
                shortageAmount: item.lowStockThreshold - item.stock
            }));

            return { success: true, data: transformedItems };
        } catch (error) {
            console.error('Error fetching low stock items:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // ADD STOCK
    // ─────────────────────────────────────────
    async addStock(inventoryId, quantity, notes = '') {
        try {
            if (quantity <= 0) {
                return { success: false, message: 'Quantity must be greater than 0' };
            }

            const item = await InventoryItem.findOne({ inventoryId });
            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }

            const oldStock = item.stock;
            item.stock += quantity;
            item.lastRestocked = new Date();
            if (notes) item.notes = notes;
            
            await item.save();
            await item.populate('item');

            // Update the source model's stock if needed
            if (item.itemType === 'RawMaterial') {
                await RawMaterial.findByIdAndUpdate(item.item._id, {
                    $inc: { stock: quantity }
                });
            }

            const itemName = item.item?.name || item.item?.productId || item.item?.materialId;
            
            return {
                success: true,
                message: `Added ${quantity} ${item.unit} to ${itemName}`,
                data: {
                    ...item.toObject(),
                    itemType: item.itemType === 'Product' ? 'product' : 'rawMaterial',
                    previousStock: oldStock,
                    newStock: item.stock,
                    quantityAdded: quantity
                }
            };

        } catch (error) {
            console.error('Error adding stock:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DEDUCT STOCK
    // ─────────────────────────────────────────
    async deductStock(inventoryId, quantity, notes = '') {
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
                    message: `Insufficient stock. Available: ${item.stock} ${item.unit}, Requested: ${quantity}`,
                    currentStock: item.stock,
                    requestedQuantity: quantity
                };
            }

            const oldStock = item.stock;
            item.stock -= quantity;
            if (notes) item.notes = notes;
            
            await item.save();
            await item.populate('item');

            // Update the source model's stock if needed
            if (item.itemType === 'RawMaterial') {
                await RawMaterial.findByIdAndUpdate(item.item._id, {
                    $inc: { stock: -quantity }
                });
            }

            const itemName = item.item?.name || item.item?.productId || item.item?.materialId;
            const isLowStock = item.stock <= item.lowStockThreshold;
            
            return {
                success: true,
                message: `Deducted ${quantity} ${item.unit} from ${itemName}`,
                data: {
                    ...item.toObject(),
                    itemType: item.itemType === 'Product' ? 'product' : 'rawMaterial',
                    previousStock: oldStock,
                    newStock: item.stock,
                    quantityDeducted: quantity,
                    isLowStock: isLowStock
                }
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
            // Prevent overwriting protected fields
            const { inventoryId: _id, itemType, ...safePayload } = payload;
            
            // Don't allow changing critical fields
            delete safePayload.inventoryId;

            const item = await InventoryItem.findOneAndUpdate(
                { inventoryId },
                safePayload,
                { new: true, runValidators: true }
            ).populate('item');

            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }

            return {
                success: true,
                message: 'Inventory item updated successfully',
                data: {
                    ...item.toObject(),
                    itemType: item.itemType === 'Product' ? 'product' : 'rawMaterial'
                }
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

            return { 
                success: true, 
                message: 'Inventory item deleted successfully',
                data: { inventoryId, itemType: item.itemType }
            };

        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET INVENTORY SUMMARY
    // ─────────────────────────────────────────
    async getInventorySummary() {
        try {
            const totalItems = await InventoryItem.countDocuments();
            const totalProducts = await InventoryItem.countDocuments({ itemType: 'Product' });
            const totalRawMaterials = await InventoryItem.countDocuments({ itemType: 'RawMaterial' });
            
            const lowStockItems = await InventoryItem.countDocuments({
                $expr: { $lte: ['$stock', '$lowStockThreshold'] }
            });
            
            const lowStockProducts = await InventoryItem.countDocuments({
                itemType: 'Product',
                $expr: { $lte: ['$stock', '$lowStockThreshold'] }
            });
            
            const lowStockRawMaterials = await InventoryItem.countDocuments({
                itemType: 'RawMaterial',
                $expr: { $lte: ['$stock', '$lowStockThreshold'] }
            });
            
            const outOfStock = await InventoryItem.countDocuments({ stock: 0 });

            return {
                success: true,
                data: {
                    totalItems,
                    totalProducts,
                    totalRawMaterials,
                    lowStockItems,
                    lowStockProducts,
                    lowStockRawMaterials,
                    outOfStock,
                    healthyStock: totalItems - lowStockItems
                }
            };

        } catch (error) {
            console.error('Error getting inventory summary:', error);
            throw error;
        }
    }
}

module.exports = new InventoryItemService();