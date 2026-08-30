// utils/mailSender.js
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
     * Send low stock/out of stock notification (single item)
     */
    async sendStockAlert(alertData) {
        const {
            itemName,
            itemType,
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
        
        const subject = `${status} ALERT: ${itemName}${sizeName ? ` (${sizeName})` : ''}`;
        
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
     * Send bulk summary of all low/out of stock items (ONE consolidated email)
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

        const subject = `Inventory Alert: ${outOfStockItems.length} Out of Stock, ${lowStockItems.length} Low Stock Items`;

        try {
            await this.transporter.sendMail({
                from: `"Acaphop Inventory" <${process.env.EMAIL_USER}>`,
                to: process.env.COMPANY_EMAIL,
                cc: process.env.CC_EMAIL || '',
                subject: subject,
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

    /**
     * Send FULL inventory report – lists ALL items (supplies, products, sizes)
     * with their stock status (Out of Stock, Low Stock, In Stock)
     */
    async sendFullInventoryReport(items) {
        if (!items || items.length === 0) {
            return { success: false, message: 'No items to report' };
        }

        const outOfStock = items.filter(i => i.status === 'Out of Stock');
        const lowStock = items.filter(i => i.status === 'Low Stock');
        const inStock = items.filter(i => i.status === 'In Stock');

        const html = this.generateFullReportHtml({
            outOfStock,
            lowStock,
            inStock,
            totalItems: items.length,
            date: new Date()
        });

        const subject = `Inventory Summary – ${outOfStock.length} Out, ${lowStock.length} Low, ${inStock.length} In Stock`;

        try {
            await this.transporter.sendMail({
                from: `"Acaphop Inventory" <${process.env.EMAIL_USER}>`,
                to: process.env.COMPANY_EMAIL,
                cc: process.env.CC_EMAIL || '',
                subject: subject,
                html: html,
                text: `Out of Stock: ${outOfStock.length}\nLow Stock: ${lowStock.length}\nIn Stock: ${inStock.length}\n\nFull inventory attached in HTML.`
            });

            console.log(`✅ Full inventory report sent with ${items.length} items`);
            return { success: true, message: 'Full report sent successfully' };
        } catch (error) {
            console.error('❌ Full report email failed:', error);
            return { success: false, message: error.message };
        }
    }

    // ---------- HTML GENERATORS ----------

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
                    .header { background: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .status-badge { display: inline-block; background-color: ${statusColor}; color: white; padding: 6px 14px; border-radius: 20px; font-weight: bold; margin-top: 8px; }
                    .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    .detail-box { background: #f8fafc; border-radius: 6px; padding: 16px; margin: 16px 0; border-left: 4px solid ${statusColor}; }
                    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
                    .detail-label { font-weight: bold; color: #64748b; }
                    .stock-value { font-size: 20px; font-weight: bold; color: ${statusColor}; }
                    .action-btn { display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 16px; font-weight: bold; }
                    .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Inventory Alert</h1>
                        <div class="status-badge">${status}</div>
                    </div>
                    <div class="content">
                        <p>Dear Inventory Manager,</p>
                        <p>The following item requires your immediate attention:</p>
                        <div class="detail-box">
                            <div class="detail-row"><span class="detail-label">Item Type:</span><span>${itemType === 'product' ? 'Product' : 'Supply'}</span></div>
                            <div class="detail-row"><span class="detail-label">Item Name:</span><span>${itemName}</span></div>
                            ${sizeName ? `<div class="detail-row"><span class="detail-label">Size/Variant:</span><span>${sizeName}</span></div>` : ''}
                            ${category ? `<div class="detail-row"><span class="detail-label">Category:</span><span>${category}</span></div>` : ''}
                            ${itemId ? `<div class="detail-row"><span class="detail-label">Item ID:</span><span>${itemId}</span></div>` : ''}
                            <div class="detail-row"><span class="detail-label">Current Stock:</span><span class="stock-value">${currentStock.toLocaleString()} ${unit}</span></div>
                            <div class="detail-row"><span class="detail-label">Reorder Threshold:</span><span>${threshold.toLocaleString()} ${unit}</span></div>
                            <div class="detail-row"><span class="detail-label">Deficit:</span><span>${Math.max(0, threshold - currentStock).toLocaleString()} ${unit}</span></div>
                        </div>
                        <p><strong>Recommended Action:</strong></p>
                        <ul>
                            <li>${isOutOfStock ? 'Immediate restocking required' : 'Schedule restock order'}</li>
                            <li>Contact supplier for lead time</li>
                            <li>Review safety stock levels</li>
                        </ul>
                        <div style="text-align: center;">
                            <a href="${process.env.ADMIN_URL || 'http://localhost:5173'}/admin/inventory" class="action-btn">View Inventory Dashboard</a>
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
        const { itemName, itemType, currentStock, threshold, unit, sizeName } = data;
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
        const outOfStock = outOfStockItems || [];
        const lowStock = lowStockItems || [];
        const dateStr = date ? new Date(date).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
        const timeStr = date ? new Date(date).toLocaleTimeString('en-PH') : '';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; margin: 0; padding: 20px; }
                    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 22px; color: #1e293b; }
                    .header .subtitle { font-size: 14px; color: #64748b; }
                    .stats { display: flex; gap: 16px; justify-content: center; margin: 16px 0; }
                    .stat { background: #f1f5f9; padding: 8px 18px; border-radius: 6px; text-align: center; }
                    .stat-number { font-size: 24px; font-weight: bold; }
                    .stat-label { font-size: 12px; color: #475569; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0; }
                    th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; font-weight: 600; color: #475569; }
                    td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
                    .out-stock { color: #dc2626; font-weight: 600; }
                    .low-stock { color: #d97706; font-weight: 600; }
                    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
                    .badge-danger { background: #fecaca; color: #dc2626; }
                    .badge-warning { background: #fef3c7; color: #d97706; }
                    .summary-box { background: #f1f5f9; padding: 12px 16px; border-radius: 6px; border-left: 4px solid #3b82f6; margin: 16px 0; }
                    .action-btn { display: inline-block; background: #3b82f6; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
                    .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
                    @media (max-width: 600px) { table { font-size: 12px; } th, td { padding: 4px 6px; } }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Inventory Stock Alert Summary</h1>
                        <div class="subtitle">${dateStr} at ${timeStr}</div>
                    </div>
                    <div class="stats">
                        <div class="stat"><div class="stat-number" style="color:#dc2626;">${outOfStock.length}</div><div class="stat-label">Out of Stock</div></div>
                        <div class="stat"><div class="stat-number" style="color:#d97706;">${lowStock.length}</div><div class="stat-label">Low Stock</div></div>
                        <div class="stat"><div class="stat-number" style="color:#16a34a;">${totalItems || 0}</div><div class="stat-label">Total Items</div></div>
                    </div>

                    ${outOfStock.length ? `
                    <h3 style="color: #dc2626;">Out of Stock (${outOfStock.length})</h3>
                    <table>
                        <thead><tr><th>Item</th><th>Type</th><th>Stock</th><th>Threshold</th><th>Unit</th></tr></thead>
                        <tbody>
                            ${outOfStock.map(item => `
                                <tr>
                                    <td class="out-stock">${item.name}${item.sizeName ? ` <span style="font-weight:normal;color:#64748b;">(${item.sizeName})</span>` : ''}</td>
                                    <td>${item.type}</td>
                                    <td class="out-stock">0</td>
                                    <td>${item.threshold}</td>
                                    <td>${item.unit}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ` : ''}

                    ${lowStock.length ? `
                    <h3 style="color: #d97706;">Low Stock (${lowStock.length})</h3>
                    <table>
                        <thead><tr><th>Item</th><th>Type</th><th>Stock</th><th>Threshold</th><th>Unit</th><th>Status</th></tr></thead>
                        <tbody>
                            ${lowStock.map(item => `
                                <tr>
                                    <td>${item.name}${item.sizeName ? ` <span style="font-weight:normal;color:#64748b;">(${item.sizeName})</span>` : ''}</td>
                                    <td>${item.type}</td>
                                    <td class="low-stock">${item.currentStock}</td>
                                    <td>${item.threshold}</td>
                                    <td>${item.unit}</td>
                                    <td><span class="badge badge-warning">Low Stock</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ` : ''}

                    ${totalItems === 0 ? `
                    <div class="summary-box" style="border-left-color: #22c55e;">
                        <p style="color: #059669; font-weight: 600; margin: 0;">All inventory levels are adequate. No action needed.</p>
                    </div>
                    ` : `
                    <div class="summary-box">
                        <p style="font-weight: 600; margin: 0;">Summary:</p>
                        <ul style="margin: 8px 0 0 20px; color: #475569;">
                            <li>${outOfStock.length} item(s) <strong style="color:#dc2626;">out of stock</strong> – immediate restocking required</li>
                            <li>${lowStock.length} item(s) <strong style="color:#d97706;">low stock</strong> – schedule replenishment</li>
                            <li>Total of ${totalItems} item(s) need attention</li>
                        </ul>
                    </div>
                    `}

                    <div style="text-align: center;">
                        <a href="${process.env.ADMIN_FRONTEND_URL || 'http://localhost:5174'}/dashboard/inventory" class="action-btn">View Inventory Dashboard</a>
                    </div>
                    <div class="footer">
                        <p>This is an automated consolidated notification from Acaphop Inventory System.</p>
                        <p>Generated: ${new Date().toISOString()}</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Generate HTML for the full inventory report – simple tables, no emojis.
     */
    generateFullReportHtml({ outOfStock, lowStock, inStock, totalItems, date }) {
        const dateStr = date ? new Date(date).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
        const timeStr = date ? new Date(date).toLocaleTimeString('en-PH') : '';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; background: #f8fafc; margin: 0; padding: 20px; }
                    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); padding: 30px; }
                    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
                    .header h1 { margin: 0; font-size: 22px; color: #1e293b; }
                    .header .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
                    .summary { background: #f1f5f9; padding: 12px 20px; border-radius: 6px; margin-bottom: 24px; }
                    .summary p { margin: 4px 0; font-size: 14px; }
                    .section { margin-top: 28px; }
                    .section h2 { font-size: 18px; margin: 0 0 12px 0; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    th { background: #f1f5f9; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; font-weight: 600; color: #475569; }
                    td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
                    .status-out { color: #dc2626; font-weight: 600; }
                    .status-low { color: #d97706; font-weight: 600; }
                    .status-in { color: #16a34a; font-weight: 600; }
                    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
                    .btn { display: inline-block; background: #3b82f6; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 16px; }
                    @media (max-width: 600px) { table { font-size: 12px; } th, td { padding: 4px 6px; } }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Full Inventory Report</h1>
                        <div class="subtitle">${dateStr} at ${timeStr}</div>
                    </div>

                    <div class="summary">
                        <p><strong>Total items:</strong> ${totalItems} &nbsp;|&nbsp; <strong>Out of Stock:</strong> ${outOfStock.length} &nbsp;|&nbsp; <strong>Low Stock:</strong> ${lowStock.length} &nbsp;|&nbsp; <strong>In Stock:</strong> ${inStock.length}</p>
                    </div>

                    ${outOfStock.length ? `
                    <div class="section">
                        <h2>Out of Stock (${outOfStock.length})</h2>
                        <table>
                            <thead><tr><th>Item</th><th>Type</th><th>Stock</th><th>Threshold</th><th>Unit</th></tr></thead>
                            <tbody>
                                ${outOfStock.map(i => `
                                    <tr>
                                        <td><strong>${i.name}${i.sizeName ? ` (${i.sizeName})` : ''}</strong></td>
                                        <td>${i.type}</td>
                                        <td class="status-out">0</td>
                                        <td>${i.threshold}</td>
                                        <td>${i.unit}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}

                    ${lowStock.length ? `
                    <div class="section">
                        <h2>Low Stock (${lowStock.length})</h2>
                        <table>
                            <thead><tr><th>Item</th><th>Type</th><th>Stock</th><th>Threshold</th><th>Unit</th></tr></thead>
                            <tbody>
                                ${lowStock.map(i => `
                                    <tr>
                                        <td>${i.name}${i.sizeName ? ` (${i.sizeName})` : ''}</td>
                                        <td>${i.type}</td>
                                        <td class="status-low">${i.currentStock}</td>
                                        <td>${i.threshold}</td>
                                        <td>${i.unit}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}

                    ${inStock.length ? `
                    <div class="section">
                        <h2>In Stock (${inStock.length})</h2>
                        <table>
                            <thead><tr><th>Item</th><th>Type</th><th>Stock</th><th>Threshold</th><th>Unit</th></tr></thead>
                            <tbody>
                                ${inStock.map(i => `
                                    <tr>
                                        <td>${i.name}${i.sizeName ? ` (${i.sizeName})` : ''}</td>
                                        <td>${i.type}</td>
                                        <td class="status-in">${i.currentStock}</td>
                                        <td>${i.threshold}</td>
                                        <td>${i.unit}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}

                    <div style="text-align: center; margin-top: 24px;">
                        <a href="${process.env.ADMIN_URL || 'http://localhost:5173'}/admin/inventory" class="btn">View Inventory Dashboard</a>
                    </div>

                    <div class="footer">
                        <p>This is an automated full inventory report from Acaphop Inventory System.</p>
                        <p>Generated: ${new Date().toISOString()}</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
}

module.exports = new MailService();