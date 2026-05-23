// routes/DashboardRoutes.js
const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/authMiddleware');
const Order = require('../models/Order.Model');
const Product = require('../models/Product.Model');
const Supply = require('../models/Supply.Model');
const InventoryItem = require('../models/InventoryItem.Model');

// ─────────────────────────────────────────
// GET DASHBOARD STATISTICS
// ─────────────────────────────────────────
router.get('/stats', verifyAdminToken, async (req, res) => {
  try {
    // Order statistics
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'Pending' });
    const scheduledOrders = await Order.countDocuments({ status: 'Scheduled' });
    const inProductionOrders = await Order.countDocuments({ status: 'In Production' });
    const outForDeliveryOrders = await Order.countDocuments({ status: 'Out for Delivery' });
    const completedOrders = await Order.countDocuments({ status: 'Completed' });
    const cancelledOrders = await Order.countDocuments({ status: 'Cancelled' });
    
    // Revenue from completed and paid orders
    const totalRevenue = await Order.aggregate([
      { $match: { status: 'Completed', paymentStatus: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Order types
    const ownCupsOrders = await Order.countDocuments({ isProvided: true });
    const companyProductOrders = await Order.countDocuments({ isProvided: false });
    
    // Product and supply counts
    const productsCount = await Product.countDocuments();
    const suppliesCount = await Supply.countDocuments();
    
    // Low stock counts
    const lowStockProducts = await Product.countDocuments({
      'sizes.stock': { $lt: 100, $gt: 0 }
    });
    
    const lowStockSupplies = await InventoryItem.countDocuments({
      stock: { $lt: 100, $gt: 0 },
      itemType: 'supply'
    });
    
    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        scheduledOrders,
        inProductionOrders,
        outForDeliveryOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        ownCupsOrders,
        companyProductOrders,
        productsCount,
        suppliesCount,
        lowStockProducts,
        lowStockSupplies
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────
// GET RECENT ORDERS
// ─────────────────────────────────────────
router.get('/recent-orders', verifyAdminToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const orders = await Order.find()
      .sort({ orderedAt: -1 })
      .limit(limit);
    
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────
// GET REVENUE BY CATEGORY
// ─────────────────────────────────────────
router.get('/revenue-by-category', verifyAdminToken, async (req, res) => {
  try {
    // Get all completed and paid orders
    const orders = await Order.find({ 
      status: 'Completed', 
      paymentStatus: 'Paid',
      isProvided: false // Only company products
    });
    
    const categoryRevenue = {};
    
    for (const order of orders) {
      // Determine category from product
      let category = order.productName?.split(' ')[0] || 'Other';
      
      // If productId exists, get category from product model
      if (order.productId) {
        const product = await Product.findOne({ id: order.productId });
        if (product) {
          category = product.category || product.subcategory || 'Other';
        }
      }
      
      const amount = order.amount || 0;
      categoryRevenue[category] = (categoryRevenue[category] || 0) + amount;
    }
    
    const result = Object.entries(categoryRevenue).map(([name, revenue]) => ({
      name,
      revenue: Math.round(revenue)
    })).sort((a, b) => b.revenue - a.revenue);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching revenue by category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────
// GET WEEKLY SALES TREND
// ─────────────────────────────────────────
router.get('/weekly-sales', verifyAdminToken, async (req, res) => {
  try {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6); // Last 7 days
    startDate.setHours(0, 0, 0, 0);
    
    // Get orders from last 7 days
    const orders = await Order.find({
      orderedAt: { $gte: startDate },
      status: 'Completed',
      paymentStatus: 'Paid'
    });
    
    // Initialize daily sales
    const dailySales = {};
    days.forEach(day => { dailySales[day] = 0; });
    
    for (const order of orders) {
      const orderDate = new Date(order.orderedAt);
      const dayIndex = orderDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      let dayName;
      
      if (dayIndex === 0) {
        dayName = 'Sun';
      } else {
        dayName = days[dayIndex - 1];
      }
      
      dailySales[dayName] = (dailySales[dayName] || 0) + (order.amount || 0);
    }
    
    const result = days.map(day => ({
      day,
      value: Math.round(dailySales[day]),
      displayValue: (dailySales[day] / 1000).toFixed(1) + 'k'
    }));
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching weekly sales:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────
// GET LOW STOCK ITEMS (Unified)
// ─────────────────────────────────────────
router.get('/low-stock', verifyAdminToken, async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 100;
    
    // Get low stock products (checking sizes)
    const products = await Product.find({
      'sizes.stock': { $lt: threshold, $gt: 0 }
    });
    
    const lowStockProducts = products.map(product => ({
      itemId: product.id,
      itemType: 'product',
      itemRef: product,
      stock: product.sizes.reduce((sum, size) => sum + (size.stock || 0), 0),
      threshold: threshold,
      status: 'Low Stock'
    }));
    
    // Get low stock supplies from inventory
    const supplies = await InventoryItem.find({
      itemType: 'supply',
      stock: { $lt: threshold, $gt: 0 }
    }).populate('itemRef');
    
    const allLowStockItems = [...lowStockProducts, ...supplies];
    
    res.json({ success: true, data: allLowStockItems });
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;