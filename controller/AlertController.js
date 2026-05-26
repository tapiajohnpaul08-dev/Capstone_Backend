// controller/AlertController.js
const InventoryAlertService = require('../services/InventoryAlertServices');

class AlertController {
    
    /**
     * Send alert for specific item
     * POST /api/alerts/item
     */
    async sendItemAlert(req, res) {
        try {
            const { itemId, forceSend = false } = req.body;
            
            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'itemId is required'
                });
            }
            
            const result = await InventoryAlertService.sendAlertForItem(itemId, forceSend);
            
            res.json(result);
            
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    /**
     * Send alert for product size
     * POST /api/alerts/product-size
     */
    async sendProductSizeAlert(req, res) {
        try {
            const { productId, sizeName } = req.body;
            
            if (!productId || !sizeName) {
                return res.status(400).json({
                    success: false,
                    message: 'productId and sizeName are required'
                });
            }
            
            const result = await InventoryAlertService.sendAlertForProductSize(productId, sizeName);
            
            res.json(result);
            
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    /**
     * Scan all inventory and send alerts
     * POST /api/alerts/scan-all
     */
    async scanAndAlertAll(req, res) {
        try {
            const result = await InventoryAlertService.scanAndAlertAll();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    /**
     * Send summary report
     * POST /api/alerts/summary
     */
    async sendSummaryReport(req, res) {
        try {
            const result = await InventoryAlertService.sendSummaryReport();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new AlertController();