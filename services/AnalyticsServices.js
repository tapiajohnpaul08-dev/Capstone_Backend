// services/AnalyticsService.js
const Order = require('../models/Order.Model');
const Product = require('../models/Product.Model');
const Supply = require('../models/Supply.Model');
const InventoryItem = require('../models/InventoryItem.Model');

class AnalyticsService {

    // ─── Shared date range helper ──────────────────────────────────────────
    _buildDateRange(dateFrom, dateTo) {
        const end   = dateTo   ? new Date(dateTo)   : new Date();
        const start = dateFrom ? new Date(dateFrom) : (() => { const d = new Date(); d.setMonth(d.getMonth() - 12); return d; })();
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    // ─── Stats ─────────────────────────────────────────────────────────────
    async getAnalyticsStats(dateFrom, dateTo) {
        try {
            const { start, end } = this._buildDateRange(dateFrom, dateTo);
            const dateFilter = { orderedAt: { $gte: start, $lte: end } };

            // Previous period (same duration)
            const duration = end - start;
            const prevEnd   = new Date(start - 1);
            const prevStart = new Date(start - duration - 1);
            const prevFilter = { orderedAt: { $gte: prevStart, $lte: prevEnd } };

            const [revenueStats, prevRevenueStats, orderCounts, prevOrderCounts, uniqueCustomers, prevCustomers] = await Promise.all([
                Order.aggregate([
                    { $match: { ...dateFilter, status: 'Completed', paymentStatus: 'Paid' } },
                    { $group: { _id: null, totalRevenue: { $sum: '$amount' }, avgOrderValue: { $avg: '$amount' } } }
                ]),
                Order.aggregate([
                    { $match: { ...prevFilter, status: 'Completed', paymentStatus: 'Paid' } },
                    { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
                ]),
                Order.aggregate([
                    { $match: dateFilter },
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ]),
                Order.aggregate([
                    { $match: prevFilter },
                    { $group: { _id: null, count: { $sum: 1 } } }
                ]),
                Order.distinct('customerEmail', dateFilter),
                Order.distinct('customerEmail', prevFilter),
            ]);

            const totalRevenue = revenueStats[0]?.totalRevenue || 0;
            const prevRevenue  = prevRevenueStats[0]?.totalRevenue || 0;
            const totalOrders  = orderCounts.reduce((s, x) => s + x.count, 0);
            const prevOrders   = prevOrderCounts[0]?.count || 0;

            const pctChange = (curr, prev) => prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);

            const allProducts = await Product.find({});
            let lowStockProducts = 0;
            for (const p of allProducts) {
                const total = p.sizes.reduce((s, z) => s + (z.stock || 0), 0);
                if (total > 0 && total < 100) lowStockProducts++;
            }

            return {
                success: true,
                data: {
                    revenue: {
                        total: totalRevenue,
                        averageOrder: revenueStats[0]?.avgOrderValue || 0,
                        change: pctChange(totalRevenue, prevRevenue)
                    },
                    orders: {
                        total: totalOrders,
                        pending:   orderCounts.find(s => s._id === 'Pending')?.count   || 0,
                        completed: orderCounts.find(s => s._id === 'Completed')?.count || 0,
                        cancelled: orderCounts.find(s => s._id === 'Cancelled')?.count || 0,
                        change: pctChange(totalOrders, prevOrders)
                    },
                    products: {
                        total: await Product.countDocuments(),
                        lowStock: lowStockProducts,
                        outOfStock: 0
                    },
                    supplies: {
                        total: await Supply.countDocuments(),
                        lowStock: await InventoryItem.countDocuments({ itemType: 'supply', stock: { $gt: 0, $lt: 100 } })
                    },
                    customers: {
                        total: uniqueCustomers.length,
                        change: pctChange(uniqueCustomers.length, prevCustomers.length)
                    },
                    period: { start, end }
                }
            };
        } catch (error) {
            console.error('Error getting analytics stats:', error);
            throw error;
        }
    }

    // ─── Top Products ──────────────────────────────────────────────────────
    async getTopProducts(limit = 5, dateFrom, dateTo) {
        try {
            const { start, end } = this._buildDateRange(dateFrom, dateTo);
            const topProducts = await Order.aggregate([
                { $match: { isProvided: false, productName: { $exists: true, $ne: null }, orderedAt: { $gte: start, $lte: end } } },
                { $group: { _id: '$productName', totalQuantity: { $sum: '$quantity' }, totalRevenue: { $sum: '$amount' }, orderCount: { $sum: 1 } } },
                { $sort: { totalQuantity: -1 } },
                { $limit: limit }
            ]);
            return { success: true, data: topProducts };
        } catch (error) {
            console.error('Error getting top products:', error);
            throw error;
        }
    }

    // ─── Order Status Distribution ────────────────────────────────────────
    async getOrderStatusDistribution(dateFrom, dateTo) {
        try {
            const { start, end } = this._buildDateRange(dateFrom, dateTo);
            const distribution = await Order.aggregate([
                { $match: { orderedAt: { $gte: start, $lte: end } } },
                { $group: { _id: '$status', value: { $sum: 1 } } }
            ]);
            const statusColors = {
                'Pending': '#f59e0b', 'Scheduled': '#8b5cf6', 'In Production': '#3b82f6',
                'Out for Delivery': '#06b6d4', 'Completed': '#10b981', 'Cancelled': '#ef4444'
            };
            const result = distribution.map(item => ({
                label: item._id, value: item.value,
                color: statusColors[item._id] || '#6b7280'
            }));
            return { success: true, data: result };
        } catch (error) {
            console.error('Error getting order status distribution:', error);
            throw error;
        }
    }

    // ─── Revenue by Category ──────────────────────────────────────────────
    async getRevenueByCategory(dateFrom, dateTo) {
        try {
            const { start, end } = this._buildDateRange(dateFrom, dateTo);
            const revenue = await Order.aggregate([
                { $match: { isProvided: false, orderedAt: { $gte: start, $lte: end } } },
                { $lookup: { from: 'products', localField: 'productId', foreignField: 'id', as: 'product' } },
                { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
                { $group: { _id: { $ifNull: ['$product.category', 'Other'] }, revenue: { $sum: '$amount' }, orders: { $sum: 1 } } },
                { $sort: { revenue: -1 } }
            ]);
            return { success: true, data: revenue.map(item => ({ name: item._id, revenue: item.revenue, orders: item.orders })) };
        } catch (error) {
            console.error('Error getting revenue by category:', error);
            throw error;
        }
    }

    // ─── Monthly Revenue Trend ────────────────────────────────────────────
    async getMonthlyRevenueTrend(months = 12) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - months + 1);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);

            const monthlyData = await Order.aggregate([
                { $match: { orderedAt: { $gte: startDate, $lte: endDate }, isProvided: false } },
                { $group: {
                    _id: { year: { $year: '$orderedAt' }, month: { $month: '$orderedAt' } },
                    revenue: { $sum: '$amount' }, orders: { $sum: 1 }
                }},
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]);

            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const now = new Date();
            const result = [];
            for (let i = months - 1; i >= 0; i--) {
                const d = new Date(); d.setMonth(now.getMonth() - i);
                const year = d.getFullYear(), month = d.getMonth();
                const found = monthlyData.find(x => x._id.year === year && x._id.month === month + 1);
                result.push({ month: monthNames[month], year, revenue: found?.revenue || 0, orders: found?.orders || 0 });
            }
            return { success: true, data: result };
        } catch (error) {
            console.error('Error getting monthly revenue trend:', error);
            throw error;
        }
    }

    // ─── Filtered analytics (date range) ─────────────────────────────────
    async getFilteredAnalytics(dateFrom, dateTo, groupBy = 'month') {
        try {
            const { start, end } = this._buildDateRange(dateFrom, dateTo);
            let groupId;
            if (groupBy === 'day')   groupId = { year: { $year: '$orderedAt' }, month: { $month: '$orderedAt' }, day: { $dayOfMonth: '$orderedAt' } };
            else if (groupBy === 'week') groupId = { year: { $year: '$orderedAt' }, week: { $isoWeek: '$orderedAt' } };
            else groupId = { year: { $year: '$orderedAt' }, month: { $month: '$orderedAt' } };

            const data = await Order.aggregate([
                { $match: { orderedAt: { $gte: start, $lte: end }, isProvided: false } },
                { $group: { _id: groupId, revenue: { $sum: '$amount' }, orders: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
            ]);
            return { success: true, data };
        } catch (error) {
            console.error('Error getting filtered analytics:', error);
            throw error;
        }
    }

    // ─── Revenue forecast (simple linear regression) ──────────────────────
    async getRevenueForecast() {
        try {
            // Get last 6 months as basis
            const endDate = new Date();
            const startDate = new Date(); startDate.setMonth(startDate.getMonth() - 6);
            const monthlyData = await Order.aggregate([
                { $match: { orderedAt: { $gte: startDate, $lte: endDate }, isProvided: false } },
                { $group: { _id: { year: { $year: '$orderedAt' }, month: { $month: '$orderedAt' } }, revenue: { $sum: '$amount' } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]);
            // Linear regression
            const n = monthlyData.length;
            if (n < 2) return { success: true, data: [] };
            const xs = monthlyData.map((_, i) => i);
            const ys = monthlyData.map(d => d.revenue);
            const sumX = xs.reduce((a, b) => a + b, 0);
            const sumY = ys.reduce((a, b) => a + b, 0);
            const sumXY = xs.reduce((a, b, i) => a + b * ys[i], 0);
            const sumX2 = xs.reduce((a, b) => a + b * b, 0);
            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const forecast = [];
            for (let i = 1; i <= 3; i++) {
                const d = new Date(); d.setMonth(d.getMonth() + i);
                const pred = Math.max(0, Math.round(intercept + slope * (n - 1 + i)));
                forecast.push({ month: monthNames[d.getMonth()], year: d.getFullYear(), revenue: pred, isForecast: true });
            }
            return { success: true, data: forecast };
        } catch (error) {
            console.error('Forecast error:', error);
            throw error;
        }
    }

    // ─── Low stock products ───────────────────────────────────────────────
    async getLowStockProducts(threshold = 500) {
        try {
            const products = await Product.find({});
            const lowStock = [];
            for (const p of products) {
                for (const size of (p.sizes || [])) {
                    const stock = size.stock || 0;
                    if (stock <= threshold) {
                        lowStock.push({
                            productId: p.id,
                            productName: p.name,
                            sizeName: size.name,
                            stock,
                            threshold,
                            status: stock === 0 ? 'out' : stock < threshold * 0.2 ? 'critical' : 'low'
                        });
                    }
                }
            }
            lowStock.sort((a, b) => a.stock - b.stock);
            return { success: true, data: lowStock };
        } catch (error) {
            console.error('Low stock error:', error);
            throw error;
        }
    }

    // ─── Top customers ────────────────────────────────────────────────────
    async getTopCustomers(limit = 10) {
        try {
            const customers = await Order.aggregate([
                { $match: { customerEmail: { $exists: true, $ne: null } } },
                { $group: {
                    _id: '$customerEmail',
                    name: { $first: '$customerName' },
                    totalSpent: { $sum: '$amount' },
                    totalOrders: { $sum: 1 },
                    lastOrder: { $max: '$orderedAt' }
                }},
                { $sort: { totalSpent: -1 } },
                { $limit: limit }
            ]);
            return { success: true, data: customers };
        } catch (error) {
            console.error('Top customers error:', error);
            throw error;
        }
    }
}

module.exports = new AnalyticsService();