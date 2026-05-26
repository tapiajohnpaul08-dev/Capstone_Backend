// services/InventoryAlertService.js
const mailService = require('../utils/mailSender');
const InventoryItem = require('../models/InventoryItem.Model');
const Product = require('../models/Product.Model');
const Supply = require('../models/Supply.Model');

class InventoryAlertService {
    
    /**
     * Send alert for a specific item (check stock levels)
     */
    async sendAlertForItem(itemId, forceSend = false) {
        try {
            // Get inventory item with proper population based on type
            const inventoryItem = await InventoryItem.findOne({ itemId });
            
            if (!inventoryItem) {
                return { success: false, message: 'Item not found' };
            }
            
            // Populate based on item type
            let itemRef = null;
            if (inventoryItem.itemType === 'supply') {
                itemRef = await Supply.findById(inventoryItem.itemRef);
            } else if (inventoryItem.itemType === 'product') {
                itemRef = await Product.findById(inventoryItem.itemRef);
            }
            
            if (!itemRef) {
                return { success: false, message: 'Referenced item not found' };
            }
            
            const needsAlert = forceSend || this.needsAlert(inventoryItem.stock, inventoryItem.threshold);
            
            if (!needsAlert && !forceSend) {
                return { success: false, message: 'Stock level is adequate, no alert needed' };
            }
            
            // Send email notification
            const result = await mailService.sendStockAlert({
                itemName: itemRef.name,
                itemType: inventoryItem.itemType,
                currentStock: inventoryItem.stock,
                threshold: inventoryItem.threshold,
                unit: inventoryItem.unit,
                category: itemRef.category || (inventoryItem.itemType === 'product' ? itemRef.category : itemRef.category),
                itemId: inventoryItem.itemId
            });
            
            return result;
            
        } catch (error) {
            console.error('Error sending alert:', error);
            return { success: false, message: error.message };
        }
    }
    
    /**
     * Send alert for a specific product size
     */
    async sendAlertForProductSize(productId, sizeName) {
        try {
            const product = await Product.findOne({ id: productId });
            
            if (!product) {
                return { success: false, message: 'Product not found' };
            }
            
            const size = product.sizes.find(s => s.name === sizeName);
            if (!size) {
                return { success: false, message: 'Size not found' };
            }
            
            const threshold = 100;
            const needsAlert = this.needsAlert(size.stock || 0, threshold);
            
            if (!needsAlert) {
                return { success: false, message: 'Stock level is adequate' };
            }
            
            const result = await mailService.sendStockAlert({
                itemName: product.name,
                itemType: 'product',
                currentStock: size.stock || 0,
                threshold: threshold,
                unit: 'pcs',
                sizeName: sizeName,
                category: product.category,
                itemId: productId
            });
            
            return result;
            
        } catch (error) {
            console.error('Error sending product size alert:', error);
            return { success: false, message: error.message };
        }
    }
    
    /**
     * Check all inventory and send alerts for low/out of stock items
     */
    async scanAndAlertAll() {
        const alertsSent = [];
        const errors = [];
        
        try {
            // Get all inventory items (supplies)
            const inventoryItems = await InventoryItem.find({ isActive: true });
            
            console.log(`Found ${inventoryItems.length} inventory items to check`);
            
            for (const item of inventoryItems) {
                // Fetch the actual item based on type using ObjectId
                let itemRef = null;
                
                if (item.itemType === 'supply') {
                    itemRef = await Supply.findById(item.itemRef);
                    console.log(`Checking supply: ${itemRef?.name}, Stock: ${item.stock}, Threshold: ${item.threshold}`);
                } else if (item.itemType === 'product') {
                    itemRef = await Product.findById(item.itemRef);
                    console.log(`Checking product: ${itemRef?.name}, Stock: ${item.stock}, Threshold: ${item.threshold}`);
                }
                
                if (!itemRef) {
                    console.log(`Skipping - Item reference not found for ${item.itemId}`);
                    continue;
                }
                
                if (this.needsAlert(item.stock, item.threshold)) {
                    console.log(`Sending alert for ${item.itemType}: ${itemRef.name}`);
                    
                    const result = await mailService.sendStockAlert({
                        itemName: itemRef.name,
                        itemType: item.itemType,
                        currentStock: item.stock,
                        threshold: item.threshold,
                        unit: item.unit,
                        category: itemRef.category,
                        itemId: item.itemId
                    });
                    
                    if (result.success) {
                        alertsSent.push({
                            itemId: item.itemId,
                            name: itemRef.name,
                            stock: item.stock,
                            type: item.itemType
                        });
                    } else {
                        errors.push({ itemId: item.itemId, error: result.message });
                    }
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Also check product sizes (products have their own stock in sizes array)
            await this.scanProductSizes(alertsSent, errors);
            
            console.log(`Scan complete: ${alertsSent.length} alerts sent, ${errors.length} errors`);
            
            return {
                success: true,
                alertsSent: alertsSent.length,
                details: { alertsSent, errors }
            };
            
        } catch (error) {
            console.error('Error scanning inventory:', error);
            return { success: false, message: error.message };
        }
    }
    
    /**
     * Scan all products and check their sizes
     */
    async scanProductSizes(alertsSent, errors) {
        const products = await Product.find();
        
        console.log(`Checking ${products.length} products for size stock alerts`);
        
        for (const product of products) {
            if (product.sizes && product.sizes.length > 0) {
                for (const size of product.sizes) {
                    const stock = size.stock || 0;
                    const threshold = 100;
                    
                    if (this.needsAlert(stock, threshold)) {
                        console.log(`Sending alert for product size: ${product.name} (${size.name}), stock: ${stock}`);
                        
                        const result = await mailService.sendStockAlert({
                            itemName: product.name,
                            itemType: 'product',
                            currentStock: stock,
                            threshold: threshold,
                            unit: 'pcs',
                            sizeName: size.name,
                            category: product.category,
                            itemId: product.id
                        });
                        
                        if (result.success) {
                            alertsSent.push({
                                itemId: product.id,
                                name: `${product.name} (${size.name})`,
                                stock: stock,
                                type: 'product_size'
                            });
                        } else {
                            errors.push({ itemId: product.id, error: result.message });
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
        }
    }
    
    /**
     * Send a single summary report of all problematic items
     */
    async sendSummaryReport() {
        try {
            const problematicItems = [];
            
            // Check inventory items (supplies and product inventory)
            const inventoryItems = await InventoryItem.find({ isActive: true });
            
            for (const item of inventoryItems) {
                let itemRef = null;
                let itemName = '';
                
                if (item.itemType === 'supply') {
                    itemRef = await Supply.findById(item.itemRef);
                    if (itemRef) itemName = itemRef.name;
                } else if (item.itemType === 'product') {
                    itemRef = await Product.findById(item.itemRef);
                    if (itemRef) itemName = itemRef.name;
                }
                
                if (itemName && this.needsAlert(item.stock, item.threshold)) {
                    problematicItems.push({
                        name: itemName,
                        type: item.itemType,
                        currentStock: item.stock,
                        threshold: item.threshold,
                        unit: item.unit,
                        sizeName: null
                    });
                }
            }
            
            // Check product sizes
            const products = await Product.find();
            
            for (const product of products) {
                if (product.sizes) {
                    for (const size of product.sizes) {
                        const stock = size.stock || 0;
                        if (this.needsAlert(stock, 100)) {
                            problematicItems.push({
                                name: product.name,
                                type: 'product',
                                currentStock: stock,
                                threshold: 100,
                                unit: 'pcs',
                                sizeName: size.name
                            });
                        }
                    }
                }
            }
            
            if (problematicItems.length === 0) {
                return { success: false, message: 'No problematic items found' };
            }
            
            const result = await mailService.sendBulkStockAlert(problematicItems);
            return result;
            
        } catch (error) {
            console.error('Error sending summary report:', error);
            return { success: false, message: error.message };
        }
    }
    
    /**
     * Helper: Check if item needs alert
     */
    needsAlert(stock, threshold) {
        const stockNum = Number(stock) || 0;
        const thresholdNum = Number(threshold) || 0;
        return stockNum === 0 || (stockNum > 0 && stockNum <= thresholdNum);
    }
}

module.exports = new InventoryAlertService();