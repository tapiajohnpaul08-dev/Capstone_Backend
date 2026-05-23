// services/InventoryItemService.js
const InventoryItem = require('../models/InventoryItem.Model');
const Product = require('../models/Product.Model');
const Supply = require('../models/Supply.Model');
const generateId = require('../utils/generateItemId');

class InventoryService {

    // ─────────────────────────────────────────
    // ADD PRODUCT TO INVENTORY
    // ─────────────────────────────────────────
    async addProductToInventory(productId, inventoryData) {
        try {
            const product = await Product.findOne({ id: productId });
            if (!product) {
                return { success: false, message: 'Product not found' };
            }

            const existing = await InventoryItem.findOne({ itemRef: product._id, itemType: 'product' });
            if (existing) {
                return { success: false, message: 'Product already in inventory' };
            }

            const inventoryItem = new InventoryItem({
                itemId: await generateId('INV', 4),
                itemType: 'product',
                itemRef: product._id,
                stock: inventoryData.stock || 0,
                unit: inventoryData.unit || 'piece',
                threshold: inventoryData.threshold || 100,
                unitCost: inventoryData.unitCost || (product.sizes?.[0]?.price || 0),
                notes: inventoryData.notes || '',
                location: inventoryData.location || 'Warehouse A',
                binLocation: inventoryData.binLocation || ''
            });

            await inventoryItem.save();
            
            // Populate with specific model
            await inventoryItem.populate({
                path: 'itemRef',
                model: 'Product'
            });

            return {
                success: true,
                message: 'Product added to inventory successfully',
                data: inventoryItem
            };

        } catch (error) {
            console.error('Error adding product to inventory:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // ADD SUPPLY TO INVENTORY
    // ─────────────────────────────────────────
    async addSupplyToInventory(supplyId, inventoryData) {
        try {
            const supply = await Supply.findOne({ supplyId });
            if (!supply) {
                return { success: false, message: 'Supply not found' };
            }

            const existing = await InventoryItem.findOne({ itemRef: supply._id, itemType: 'supply' });
            if (existing) {
                return { success: false, message: 'Supply already in inventory' };
            }

            const inventoryItem = new InventoryItem({
                itemId: await generateId('INV', 4),
                itemType: 'supply',
                itemRef: supply._id,
                stock: inventoryData.stock || 0,
                unit: inventoryData.unit || supply.unit,
                threshold: inventoryData.threshold || 100,
                unitCost: inventoryData.unitCost || supply.unitCost,
                notes: inventoryData.notes || '',
                location: inventoryData.location || 'Warehouse A',
                binLocation: inventoryData.binLocation || ''
            });

            await inventoryItem.save();
            
            // Populate with specific model
            await inventoryItem.populate({
                path: 'itemRef',
                model: 'Supply'
            });

            return {
                success: true,
                message: 'Supply added to inventory successfully',
                data: inventoryItem
            };

        } catch (error) {
            console.error('Error adding supply to inventory:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ALL INVENTORY ITEMS
    // ─────────────────────────────────────────
    async getAllInventory() {
        try {
            const items = await InventoryItem.find()
                .sort({ createdAt: -1 });
            
            // Manually populate each item based on its type
            const populatedItems = [];
            for (const item of items) {
                let populatedItem = item.toObject();
                if (item.itemType === 'product') {
                    const product = await Product.findById(item.itemRef);
                    populatedItem.itemRef = product;
                } else if (item.itemType === 'supply') {
                    const supply = await Supply.findById(item.itemRef);
                    populatedItem.itemRef = supply;
                }
                populatedItems.push(populatedItem);
            }
            
            return { success: true, data: populatedItems };
        } catch (error) {
            console.error('Error fetching inventory:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET INVENTORY BY TYPE
    // ─────────────────────────────────────────
    async getInventoryByType(type) {
        try {
            const items = await InventoryItem.find({ itemType: type })
                .sort({ createdAt: -1 });
            
            // Manually populate based on type
            const populatedItems = [];
            const modelToUse = type === 'product' ? Product : Supply;
            
            for (const item of items) {
                let populatedItem = item.toObject();
                const refItem = await modelToUse.findById(item.itemRef);
                populatedItem.itemRef = refItem;
                populatedItems.push(populatedItem);
            }
            
            return { success: true, data: populatedItems };
        } catch (error) {
            console.error('Error fetching inventory by type:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET INVENTORY ITEM BY ID
    // ─────────────────────────────────────────
    async getInventoryById(itemId) {
        try {
            const item = await InventoryItem.findOne({ itemId });
            
            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }
            
            // Manually populate based on type
            let populatedItem = item.toObject();
            if (item.itemType === 'product') {
                const product = await Product.findById(item.itemRef);
                populatedItem.itemRef = product;
            } else if (item.itemType === 'supply') {
                const supply = await Supply.findById(item.itemRef);
                populatedItem.itemRef = supply;
            }
            
            return { success: true, data: populatedItem };
        } catch (error) {
            console.error('Error fetching inventory item:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE STOCK
    // ─────────────────────────────────────────
    async updateStock(itemId, quantity, operation = 'set') {
        try {
            const inventoryItem = await InventoryItem.findOne({ itemId });
            
            if (!inventoryItem) {
                return { success: false, message: 'Inventory item not found' };
            }

            let newStock;
            let newLastRestocked = inventoryItem.lastRestocked;
            
            switch (operation) {
                case 'add':
                    newStock = inventoryItem.stock + quantity;
                    newLastRestocked = new Date();
                    break;
                case 'subtract':
                    newStock = Math.max(0, inventoryItem.stock - quantity);
                    break;
                default:
                    newStock = quantity;
            }

            const updatedItem = await InventoryItem.findOneAndUpdate(
                { itemId },
                { 
                    stock: newStock,
                    lastRestocked: newLastRestocked,
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            // Populate the result
            let populatedItem = updatedItem.toObject();
            if (updatedItem.itemType === 'product') {
                const product = await Product.findById(updatedItem.itemRef);
                populatedItem.itemRef = product;
            } else if (updatedItem.itemType === 'supply') {
                const supply = await Supply.findById(updatedItem.itemRef);
                populatedItem.itemRef = supply;
            }

            return {
                success: true,
                message: `Stock updated successfully`,
                data: populatedItem
            };

        } catch (error) {
            console.error('Error updating stock:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE INVENTORY ITEM
    // ─────────────────────────────────────────
    async updateInventoryItem(itemId, payload) {
        try {
            const { itemId: _id, ...updateData } = payload;
            updateData.updatedAt = new Date();

            const item = await InventoryItem.findOneAndUpdate(
                { itemId },
                updateData,
                { new: true, runValidators: true }
            );

            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }
            
            // Populate the result
            let populatedItem = item.toObject();
            if (item.itemType === 'product') {
                const product = await Product.findById(item.itemRef);
                populatedItem.itemRef = product;
            } else if (item.itemType === 'supply') {
                const supply = await Supply.findById(item.itemRef);
                populatedItem.itemRef = supply;
            }

            return {
                success: true,
                message: 'Inventory item updated successfully',
                data: populatedItem
            };

        } catch (error) {
            console.error('Error updating inventory item:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DELETE INVENTORY ITEM
    // ─────────────────────────────────────────
    async deleteInventoryItem(itemId) {
        try {
            const item = await InventoryItem.findOneAndDelete({ itemId });

            if (!item) {
                return { success: false, message: 'Inventory item not found' };
            }

            return { success: true, message: 'Inventory item deleted successfully' };
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET LOW STOCK ITEMS
    // ─────────────────────────────────────────
async getLowStockItems() {
    try {
        const lowStockItems = [];
        
        // 1. Get low stock supplies from inventory (keep as is - working)
        const supplies = await InventoryItem.find({ 
            itemType: 'supply',
            stock: { $gt: 0, $lt: 100 }
        }).populate('itemRef');

        for (const item of supplies) {
            const supply = await Supply.findById(item.itemRef._id);
            
            lowStockItems.push({
                itemId: item.itemId,
                itemType: 'supply',
                itemRef: {
                    _id: item.itemRef?._id,
                    supplyId: item.itemRef?.supplyId || supply?.supplyId,
                    name: supply?.name || item.itemRef?.name || 'Unknown Supply',
                    category: item.itemRef?.category || supply?.category,
                    supplier: item.itemRef?.supplier || supply?.supplier,
                    unit: item.unit || supply?.unit
                },
                stock: item.stock,
                threshold: item.threshold || 100,
                status: item.stock === 0 ? 'Out of Stock' : 'Low Stock'
            });
        }
        
        // 2. Get low stock products directly from Product model (MORE EFFICIENT)
        const products = await Product.find({});
        
        for (const product of products) {
            // Check each size for low stock
            for (const size of product.sizes) {
                if (size.stock > 0 && size.stock < 100) {
                    lowStockItems.push({
                        itemId: product.id,
                        itemType: 'product',
                        itemRef: {
                            _id: product._id,
                            id: product.id,
                            name: product.name,
                            category: product.category,
                            subcategory: product.subcategory,
                            image: product.image,
                            sizeName: size.name,
                            sizeStock: size.stock,
                            sizePrice: size.price
                        },
                        stock: size.stock,
                        threshold: 100,
                        status: 'Low Stock'
                    });
                }
            }
        }
        
        console.log(`Found ${lowStockItems.length} low stock items (${lowStockItems.filter(i => i.itemType === 'supply').length} supplies, ${lowStockItems.filter(i => i.itemType === 'product').length} products)`);
        
        return { success: true, data: lowStockItems };
    } catch (error) {
        console.error('Error fetching low stock items:', error);
        throw error;
    }
}
    // ─────────────────────────────────────────
    // GET OUT OF STOCK ITEMS
    // ─────────────────────────────────────────
    async getOutOfStockItems() {
        try {
            const items = await InventoryItem.find({ stock: 0 })
                .sort({ createdAt: -1 });
            
            // Populate results
            const populatedItems = [];
            for (const item of items) {
                let populatedItem = item.toObject();
                if (item.itemType === 'product') {
                    const product = await Product.findById(item.itemRef);
                    populatedItem.itemRef = product;
                } else if (item.itemType === 'supply') {
                    const supply = await Supply.findById(item.itemRef);
                    populatedItem.itemRef = supply;
                }
                populatedItems.push(populatedItem);
            }
            
            return { success: true, data: populatedItems };
        } catch (error) {
            console.error('Error fetching out of stock items:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET STATISTICS
    // ─────────────────────────────────────────
    async getStatistics() {
        try {
            const totalItems = await InventoryItem.countDocuments();
            const lowStockCount = await InventoryItem.countDocuments({ status: 'Low Stock' });
            const outOfStockCount = await InventoryItem.countDocuments({ stock: 0 });
            const totalValue = await InventoryItem.aggregate([
                { $group: { _id: null, total: { $sum: { $multiply: ['$stock', '$unitCost'] } } } }
            ]);

            const productCount = await InventoryItem.countDocuments({ itemType: 'product' });
            const supplyCount = await InventoryItem.countDocuments({ itemType: 'supply' });

            return {
                success: true,
                data: {
                    totalItems,
                    productCount,
                    supplyCount,
                    lowStockCount,
                    outOfStockCount,
                    totalValue: totalValue[0]?.total || 0
                }
            };
        } catch (error) {
            console.error('Error fetching statistics:', error);
            throw error;
        }
    }
}

module.exports = new InventoryService();