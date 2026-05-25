// services/AnalyticsService.js
const Order = require('../models/Order.Model');
const Product = require('../models/Product.Model');
const Supply = require('../models/Supply.Model');
const InventoryItem = require('../models/InventoryItem.Model');

class AnalyticsService {
    
    // Get main analytics stats
    async getAnalyticsStats() {
        try {
            // Revenue stats
            const revenueStats = await Order.aggregate([
                { $match: { status: 'Completed', paymentStatus: 'Paid' } },
                { $group: {
                    _id: null,
                    totalRevenue: { $sum: '$amount' },
                    avgOrderValue: { $avg: '$amount' }
                }}
            ]);
            
            // Order counts by status
            const orderCounts = await Order.aggregate([
                { $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }}
            ]);
            
            const totalOrders = orderCounts.reduce((sum, s) => sum + s.count, 0);
            const pendingOrders = orderCounts.find(s => s._id === 'Pending')?.count || 0;
            const completedOrders = orderCounts.find(s => s._id === 'Completed')?.count || 0;
            
            // Product stats
            const totalProducts = await Product.countDocuments();
            
            // Calculate low stock products from product sizes
            const allProducts = await Product.find({});
            let lowStockProducts = 0;
            for (const product of allProducts) {
                const totalStock = product.sizes.reduce((sum, size) => sum + (size.stock || 0), 0);
                if (totalStock > 0 && totalStock < 100) {
                    lowStockProducts++;
                }
            }
            
            // Supply stats from inventory
            const totalSupplies = await Supply.countDocuments();
            const lowStockSupplies = await InventoryItem.countDocuments({
                itemType: 'supply',
                stock: { $gt: 0, $lt: 100 }
            });
            
            // Customer stats
            const uniqueCustomers = await Order.distinct('customerEmail');
            
            return {
                success: true,
                data: {
                    revenue: {
                        total: revenueStats[0]?.totalRevenue || 0,
                        averageOrder: revenueStats[0]?.avgOrderValue || 0
                    },
                    orders: {
                        total: totalOrders,
                        pending: pendingOrders,
                        completed: completedOrders
                    },
                    products: {
                        total: totalProducts,
                        lowStock: lowStockProducts,
                        outOfStock: 0
                    },
                    supplies: {
                        total: totalSupplies,
                        lowStock: lowStockSupplies
                    },
                    customers: {
                        total: uniqueCustomers.length
                    }
                }
            };
        } catch (error) {
            console.error('Error getting analytics stats:', error);
            throw error;
        }
    }
    
    // Get top selling products - FIXED for your order structure
    async getTopProducts(limit = 5) {
        try {
            // Your orders store product info directly, not in items array
            const topProducts = await Order.aggregate([
                { $match: { 
                    isProvided: false,  // Only company products
                    productName: { $exists: true, $ne: null }
                }},
                { $group: {
                    _id: '$productName',  // Group by productName directly
                    totalQuantity: { $sum: '$quantity' },  // Sum quantity directly
                    totalRevenue: { $sum: '$amount' },  // Sum amount directly
                    orderCount: { $sum: 1 }
                }},
                { $sort: { totalQuantity: -1 } },  // Sort by highest quantity
                { $limit: limit }
            ]);
            
            console.log('Top products found:', topProducts);
            
            return { success: true, data: topProducts };
        } catch (error) {
            console.error('Error getting top products:', error);
            throw error;
        }
    }
    
    // Get order status distribution for pie chart
    async getOrderStatusDistribution() {
        try {
            const distribution = await Order.aggregate([
                { $group: {
                    _id: '$status',
                    value: { $sum: 1 }
                }}
            ]);
            
            const statusColors = {
                'Pending': '#f59e0b',
                'Scheduled': '#8b5cf6',
                'In Production': '#3b82f6',
                'Out for Delivery': '#06b6d4',
                'Completed': '#10b981',
                'Cancelled': '#ef4444'
            };
            
            const result = distribution.map(item => ({
                label: item._id,
                value: item.value,
                color: statusColors[item._id] || '#6b7280'
            }));
            
            return { success: true, data: result };
        } catch (error) {
            console.error('Error getting order status distribution:', error);
            throw error;
        }
    }
    
    // Get revenue by product category
   // services/AnalyticsService.js - Update getRevenueByCategory

async getRevenueByCategory() {
    try {
        // Include ALL orders regardless of status
        const revenue = await Order.aggregate([
            { $match: { 
                isProvided: false
                // Removed status and paymentStatus filters
            }},
            { $lookup: {
                from: 'products',
                localField: 'productId',
                foreignField: 'id',
                as: 'product'
            }},
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            { $group: {
                _id: { $ifNull: ['$product.category', 'Other'] },
                revenue: { $sum: '$amount' },
                orders: { $sum: 1 }
            }},
            { $sort: { revenue: -1 } }
        ]);
        
        const result = revenue.map(item => ({
            name: item._id,
            revenue: item.revenue,
            orders: item.orders
        }));
        
        console.log('Revenue by category result:', result);
        
        return { success: true, data: result };
    } catch (error) {
        console.error('Error getting revenue by category:', error);
        throw error;
    }
}
    
    // Get monthly revenue trend

// services/AnalyticsService.js - Fix getMonthlyRevenueTrend

async getMonthlyRevenueTrend(months = 12) {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months + 1); // Include current month
        
        // Include ALL orders regardless of status
        const monthlyData = await Order.aggregate([
            { $match: {
                orderedAt: { $gte: startDate, $lte: new Date() },
                isProvided: false
            }},
            { $group: {
                _id: {
                    year: { $year: '$orderedAt' },
                    month: { $month: '$orderedAt' }
                },
                revenue: { $sum: '$amount' },
                orders: { $sum: 1 }
            }},
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const result = [];
        
        // Get the current date
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Generate months going back from current month
        for (let i = months - 1; i >= 0; i--) {
            const date = new Date();
            date.setMonth(currentMonth - i);
            const year = date.getFullYear();
            const month = date.getMonth();
            const monthName = monthNames[month];
            
            const found = monthlyData.find(d => d._id.year === year && d._id.month === month + 1);
            
            result.push({
                month: monthName,
                year: year,
                revenue: found?.revenue || 0,
                orders: found?.orders || 0
            });
        }
        
        console.log('Monthly revenue data:', result);
        
        return { success: true, data: result };
    } catch (error) {
        console.error('Error getting monthly revenue trend:', error);
        throw error;
    }
}


}

module.exports = new AnalyticsService();