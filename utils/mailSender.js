// services/mailService.js
const nodemailer = require('nodemailer');

class MailService {
    constructor() {
        this.transporter = null;
        this.initTransporter();
    }

    initTransporter() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    /**
     * Send low stock/out of stock notification
     */
    async sendStockAlert(alertData) {
        const {
            itemName,
            itemType, // 'product' or 'supply'
            currentStock,
            threshold,
            unit = 'units',
            sizeName = null,
            category = '',
            itemId = '',
            recipientEmail = process.env.COMPANY_EMAIL
        } = alertData;

        const isOutOfStock = currentStock === 0;
        const status = isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK';
        const statusColor = isOutOfStock ? '#dc2626' : '#eab308';
        
        const subject = `⚠️ ${status} ALERT: ${itemName}${sizeName ? ` (${sizeName})` : ''}`;
        
        const html = this.generateAlertHtml({
            itemName,
            itemType,
            currentStock,
            threshold,
            unit,
            sizeName,
            category,
            itemId,
            isOutOfStock,
            status,
            statusColor
        });

        try {
            await this.transporter.sendMail({
                from: `"Acaphop Inventory" <${process.env.EMAIL_USER}>`,
                to: recipientEmail,
                cc: process.env.CC_EMAIL || '',
                subject: subject,
                html: html,
                text: this.generatePlainText(alertData)
            });
            
            console.log(`✅ Stock alert sent for ${itemName}${sizeName ? ` (${sizeName})` : ''}`);
            return { success: true, message: 'Notification sent successfully' };
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Send bulk summary of all low/out of stock items
     */
    async sendBulkStockAlert(items) {
        if (!items || items.length === 0) {
            return { success: false, message: 'No items to report' };
        }

        const lowStockItems = items.filter(i => i.currentStock > 0);
        const outOfStockItems = items.filter(i => i.currentStock === 0);
        
        const html = this.generateBulkAlertHtml({
            lowStockItems,
            outOfStockItems,
            totalItems: items.length,
            date: new Date()
        });

        try {
            await this.transporter.sendMail({
                from: `"Acaphop Inventory" <${process.env.EMAIL_USER}>`,
                to: process.env.COMPANY_EMAIL,
                cc: process.env.CC_EMAIL || '',
                subject: `⚠️ Inventory Alert: ${outOfStockItems.length} Out of Stock, ${lowStockItems.length} Low Stock Items`,
                html: html,
                text: `Out of Stock: ${outOfStockItems.length} items\nLow Stock: ${lowStockItems.length} items\n\nPlease check inventory dashboard.`
            });
            
            console.log(`✅ Bulk stock alert sent for ${items.length} items`);
            return { success: true, message: 'Bulk notification sent successfully' };
        } catch (error) {
            console.error('❌ Bulk email failed:', error);
            return { success: false, message: error.message };
        }
    }

    generateAlertHtml(data) {
        const {
            itemName,
            itemType,
            currentStock,
            threshold,
            unit,
            sizeName,
            category,
            itemId,
            isOutOfStock,
            status,
            statusColor
        } = data;

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .status-badge { display: inline-block; background-color: ${statusColor}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin-top: 10px; }
                    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .detail-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${statusColor}; }
                    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
                    .detail-label { font-weight: bold; color: #64748b; }
                    .detail-value { color: #1e293b; font-weight: 500; }
                    .stock-value { font-size: 20px; font-weight: bold; color: ${statusColor}; }
                    .action-btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: bold; }
                    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⚠️ Inventory Alert</h1>
                        <div class="status-badge">${status}</div>
                    </div>
                    <div class="content">
                        <p>Dear Inventory Manager,</p>
                        <p>The following item requires your immediate attention:</p>
                        
                        <div class="detail-box">
                            <div class="detail-row">
                                <span class="detail-label">Item Type:</span>
                                <span class="detail-value">${itemType === 'product' ? 'Product' : 'Supply'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Item Name:</span>
                                <span class="detail-value">${itemName}</span>
                            </div>
                            ${sizeName ? `
                            <div class="detail-row">
                                <span class="detail-label">Size/Variant:</span>
                                <span class="detail-value">${sizeName}</span>
                            </div>
                            ` : ''}
                            ${category ? `
                            <div class="detail-row">
                                <span class="detail-label">Category:</span>
                                <span class="detail-value">${category}</span>
                            </div>
                            ` : ''}
                            ${itemId ? `
                            <div class="detail-row">
                                <span class="detail-label">Item ID:</span>
                                <span class="detail-value">${itemId}</span>
                            </div>
                            ` : ''}
                            <div class="detail-row">
                                <span class="detail-label">Current Stock:</span>
                                <span class="stock-value">${currentStock.toLocaleString()} ${unit}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Reorder Threshold:</span>
                                <span class="detail-value">${threshold.toLocaleString()} ${unit}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Deficit:</span>
                                <span class="detail-value">${Math.max(0, threshold - currentStock).toLocaleString()} ${unit}</span>
                            </div>
                        </div>

                        <p><strong>Recommended Action:</strong></p>
                        <ul>
                            <li>${isOutOfStock ? '🔴 Immediate restocking required' : '🟡 Schedule restock order'}</li>
                            <li>📞 Contact supplier for lead time</li>
                            <li>📊 Review safety stock levels</li>
                        </ul>

                        <div style="text-align: center;">
                            <a href="${process.env.ADMIN_URL || 'http://localhost:5173'}/admin/inventory" class="action-btn">
                                View Inventory Dashboard
                            </a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from Acaphop Inventory System.</p>
                        <p>Time: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    generatePlainText(data) {
        const {
            itemName,
            itemType,
            currentStock,
            threshold,
            unit,
            sizeName,
        } = data;

        // isOutOfStock may not be pre-computed in alertData, derive it here
        const isOutOfStock = Number(currentStock) === 0;
        const status = isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK';
        
        return `
${status} ALERT: ${itemName}${sizeName ? ` (${sizeName})` : ''}

Item Type: ${itemType === 'product' ? 'Product' : 'Supply'}
Current Stock: ${currentStock} ${unit}
Reorder Threshold: ${threshold} ${unit}
Deficit: ${Math.max(0, threshold - currentStock)} ${unit}

Please restock immediately.

View inventory: ${process.env.ADMIN_URL || 'http://localhost:5173'}/admin/inventory

This is an automated notification from Acaphop Inventory System.
        `;
    }

    generateBulkAlertHtml({ lowStockItems, outOfStockItems, totalItems, date }) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                    .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                    th { background: #f8fafc; font-weight: bold; color: #475569; }
                    .out-stock { color: #dc2626; font-weight: bold; }
                    .low-stock { color: #eab308; font-weight: bold; }
                    .section-title { font-size: 18px; font-weight: bold; margin: 25px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
                    .action-btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
                    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📋 Inventory Stock Alert Summary</h1>
                        <p>${date.toLocaleDateString()} - ${date.toLocaleTimeString()}</p>
                    </div>
                    <div class="content">
                        <p>Dear Inventory Manager,</p>
                        <p>The following inventory items require attention:</p>

                        ${outOfStockItems.length > 0 ? `
                        <div class="section-title">🔴 Out of Stock (${outOfStockItems.length})</div>
                        <table>
                            <thead>
                                <tr><th>Item</th><th>Type</th><th>Stock</th><th>Threshold</th><th>Unit</th></tr>
                            </thead>
                            <tbody>
                                ${outOfStockItems.map(item => `
                                <tr>
                                    <td class="out-stock">${item.name}${item.sizeName ? ` (${item.sizeName})` : ''}</td>
                                    <td>${item.type === 'product' ? 'Product' : 'Supply'}</td>
                                    <td class="out-stock">0</td>
                                    <td>${item.threshold}</td>
                                    <td>${item.unit}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ` : ''}

                        ${lowStockItems.length > 0 ? `
                        <div class="section-title">⚠️ Low Stock (${lowStockItems.length})</div>
                        <table>
                            <thead>
                                <tr><th>Item</th><th>Type</th><th>Stock</th><th>Threshold</th><th>Unit</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                ${lowStockItems.map(item => `
                                <tr>
                                    <td>${item.name}${item.sizeName ? ` (${item.sizeName})` : ''}</td>
                                    <td>${item.type === 'product' ? 'Product' : 'Supply'}</td>
                                    <td>${item.currentStock}</td>
                                    <td>${item.threshold}</td>
                                    <td>${item.unit}</td>
                                    <td class="low-stock">Low Stock</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ` : ''}

                        <div style="text-align: center;">
                            <a href="${process.env.ADMIN_URL || 'http://localhost:5173'}/admin/inventory" class="action-btn">
                                Go to Inventory Dashboard
                            </a>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Automated notification from Acaphop Inventory System</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
}

module.exports = new MailService();