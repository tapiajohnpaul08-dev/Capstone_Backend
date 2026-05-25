// controller/AnalyticsController.js
const analyticsService = require('../services/AnalyticsServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class AnalyticsController {
    
    // Get main analytics stats
    getAnalyticsStats = asyncTryCatch(async (req, res, next) => {
        const response = await analyticsService.getAnalyticsStats();
        res.status(200).json(response);
    });
    
    // Get top selling products
    getTopProducts = asyncTryCatch(async (req, res, next) => {
        const limit = parseInt(req.query.limit) || 5;
        const response = await analyticsService.getTopProducts(limit);
        res.status(200).json(response);
    });
    
    // Get order status distribution
    getOrderStatusDistribution = asyncTryCatch(async (req, res, next) => {
        const response = await analyticsService.getOrderStatusDistribution();
        res.status(200).json(response);
    });
    
    // Get revenue by category
    getRevenueByCategory = asyncTryCatch(async (req, res, next) => {
        const response = await analyticsService.getRevenueByCategory();
        res.status(200).json(response);
    });
    
    // Get monthly revenue trend
    getMonthlyRevenueTrend = asyncTryCatch(async (req, res, next) => {
        const months = parseInt(req.query.months) || 12;
        const response = await analyticsService.getMonthlyRevenueTrend(months);
        res.status(200).json(response);
    });

    // Add to AnalyticsController.js
debugMonthlyRevenue = asyncTryCatch(async (req, res, next) => {
    // Get all orders with their amounts
    const allOrders = await Order.find({ isProvided: false })
        .select('orderId productId productName amount orderedAt status')
        .sort({ orderedAt: -1 });
    
    // Calculate manually
    const monthlyMap = {};
    
    for (const order of allOrders) {
        const date = order.orderedAt;
        const monthName = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        const key = `${year}-${monthName}`;
        
        if (!monthlyMap[key]) {
            monthlyMap[key] = { month: monthName, year: year, revenue: 0, orders: 0 };
        }
        monthlyMap[key].revenue += order.amount || 0;
        monthlyMap[key].orders += 1;
    }
    
    // Get last 12 months
    const result = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(today.getMonth() - i);
        const monthName = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear();
        const key = `${year}-${monthName}`;
        
        result.push({
            month: monthName,
            year: year,
            revenue: monthlyMap[key]?.revenue || 0,
            orders: monthlyMap[key]?.orders || 0
        });
    }
    
    res.json({
        success: true,
        data: {
            allOrders: allOrders.map(o => ({
                orderId: o.orderId,
                productName: o.productName,
                amount: o.amount,
                orderedAt: o.orderedAt,
                status: o.status
            })),
            monthlyData: result,
            totalRevenue: result.reduce((sum, m) => sum + m.revenue, 0)
        }
    });
});
}

module.exports = new AnalyticsController();