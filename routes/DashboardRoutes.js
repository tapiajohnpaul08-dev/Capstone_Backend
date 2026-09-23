// routes/DashboardRoutes.js
const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/authMiddleware');
const Order = require('../models/Order.Model');
const Product = require('../models/Product.Model');
const Supply = require('../models/Supply.Model');
const InventoryItem = require('../models/InventoryItem.Model');

// ─────────────────────────────────────────
// ✅ NEW — GET /admin/summary
//
// Single-shot endpoint that returns everything the dashboard needs on
// first paint: stats, revenue by category, weekly sales, low-stock items,
// and recent orders. All aggregation happens in MongoDB.
// ─────────────────────────────────────────
router.get('/summary', verifyAdminToken, async (req, res) => {
  try {
    const now = new Date();

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    // ✅ For the "today" cards
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const [
      orderStatsAgg,
      revenueCategoryAgg,
      weeklySalesAgg,
      lowStockProductsAgg,
      lowStockSuppliesAgg,
      recentOrders,
      scheduledTodayCount,       // ✅ NEW
      inProductionCount,         // ✅ NEW
      completedTodayAgg,         // ✅ NEW (count + revenue)
      pickupsReadyCount,         // ✅ NEW
      unpaidCount,               // ✅ NEW
    ] = await Promise.all([
      // ── 1. Order counts + completed revenue, one aggregate ─────
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'Completed'] }, '$amount', 0],
              },
            },
          },
        },
      ]),

      // ── 2. Revenue by category, DB-side, top 8 ──────────────────
      Order.aggregate([
        { $match: { status: 'Completed', isProvided: false } },
        { $unwind: '$items' },
        {
          $group: {
            _id: { $ifNull: ['$items.category', 'Other'] },
            revenue: { $sum: { $ifNull: ['$items.estimatedTotal', 0] } },
            orders: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 8 },
      ]),

      // ── 3. Weekly sales, one aggregate ─────────────────────────
      Order.aggregate([
        {
          $match: {
            orderedAt: { $gte: startOfWeek },
            status: 'Completed',
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$orderedAt' },
            },
            revenue: { $sum: '$amount' },
          },
        },
      ]),

      // ── 4. Low-stock products, DB-side, no full docs ───────────
      Product.aggregate([
        { $unwind: '$sizes' },
        {
          $match: {
            'sizes.stock': { $gt: 0, $lte: 500 },
          },
        },
        {
          $project: {
            _id: 0,
            id: '$id',
            name: '$name',
            category: '$category',
            sizeName: '$sizes.name',
            stock: '$sizes.stock',
          },
        },
        { $sort: { stock: 1 } },
        { $limit: 15 },
      ]),

      // ── 5. Low-stock supplies, DB-side, no full docs ───────────
      InventoryItem.aggregate([
        {
          $match: {
            itemType: 'supply',
            stock: { $gt: 0 },
            // Compare two fields on the same document — $lte: '$threshold'
            // cannot be done with a plain query; $expr is required.
            $expr: { $lte: ['$stock', '$threshold'] },
          },
        },
        {
          $lookup: {
            from: 'supplies',
            localField: 'itemRef',
            foreignField: '_id',
            as: 'supply',
          },
        },
        { $unwind: { path: '$supply', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            itemId: '$itemId',
            name: { $ifNull: ['$supply.name', 'Unknown Supply'] },
            category: { $ifNull: ['$supply.category', 'other'] },
            supplier: { $ifNull: ['$supply.supplier', 'No supplier'] },
            stock: 1,
            threshold: { $ifNull: ['$threshold', 100] },
            unit: { $ifNull: ['$unit', 'units'] },
          },
        },
        { $sort: { stock: 1 } },
        { $limit: 15 },
      ]),

      // ── 6. Recent 5 orders, lean projection ────────────────────
      Order.find({})
        .sort({ orderedAt: -1 })
        .limit(5)
        .select(
          'orderId customerName customerEmail customerPhone amount status paymentStatus receivingMode orderedAt productName quantity items',
        )
        .lean(),

      // ── 7. ✅ NEW — Orders scheduled for production TODAY ──────
      // Includes both `Scheduled` (waiting to start) and
      // `In Production` (already running) with a schedule of today.
      Order.countDocuments({
        status: { $in: ['Scheduled', 'In Production'] },
        productionSchedule: { $gte: startOfToday, $lte: endOfToday },
      }),

      // ── 8. ✅ NEW — Orders currently in production (any date) ──
      Order.countDocuments({ status: 'In Production' }),

      // ── 9. ✅ NEW — Orders completed today + revenue ───────────
      Order.aggregate([
        {
          $match: {
            status: 'Completed',
            updatedAt: { $gte: startOfToday },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: '$amount' },
          },
        },
      ]),

      // ── 10. ✅ NEW — Pickup orders currently ready ─────────────
      // "Ready for pickup" = Out for Delivery status + Pick-up mode.
      // The admin UI displays these as "Ready to Pick-up".
      Order.countDocuments({
        status: 'Out for Delivery',
        receivingMode: 'Pick-up',
      }),

      // ── 11. ✅ NEW — Unpaid/Partial orders (money still owed) ──
      Order.countDocuments({
        paymentStatus: { $in: ['Unpaid', 'Partial'] },
        status: { $nin: ['Cancelled'] },
      }),
    ]);

    // ── Shape stats ───────────────────────────────────────────────
    const stats = {
      totalOrders: 0,
      pendingOrders: 0,
      scheduledOrders: 0,
      inProductionOrders: 0,
      outForDeliveryOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0,

      // ✅ NEW — today-focused metrics
      scheduledToday:     scheduledTodayCount || 0,
      inProductionNow:    inProductionCount || 0,
      completedToday:     completedTodayAgg[0]?.count   || 0,
      revenueToday:       completedTodayAgg[0]?.revenue || 0,
      pickupsReady:       pickupsReadyCount || 0,
      unpaidOrders:       unpaidCount || 0,
    };

    for (const row of orderStatsAgg) {
      stats.totalOrders += row.count;
      switch (row._id) {
        case 'Pending':          stats.pendingOrders = row.count; break;
        case 'Scheduled':        stats.scheduledOrders = row.count; break;
        case 'In Production':    stats.inProductionOrders = row.count; break;
        case 'Out for Delivery': stats.outForDeliveryOrders = row.count; break;
        case 'Completed':
          stats.completedOrders = row.count;
          stats.totalRevenue = row.revenue;
          break;
        case 'Cancelled':        stats.cancelledOrders = row.count; break;
      }
    }

    // ── Shape weekly sales (7 days, zero-filled) ─────────────────
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyMap = new Map(weeklySalesAgg.map((r) => [r._id, r.revenue]));
    const weeklySales = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const revenue = weeklyMap.get(key) || 0;
      weeklySales.push({
        day: dayNames[d.getDay()],
        value: revenue,
        displayValue: `${(revenue / 1000).toFixed(1)}k`,
      });
    }

    // ── Shape low-stock items (merged, sorted, capped at 10) ─────
    const lowStockItems = [
      ...lowStockProductsAgg.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        threshold: 500,
        unit: 'pcs',
        status: 'Low Stock',
        type: 'product',
        category: p.category,
        sizeName: p.sizeName,
      })),
      ...lowStockSuppliesAgg.map((s) => ({
        id: s.itemId,
        name: s.name,
        stock: s.stock,
        threshold: s.threshold,
        unit: s.unit,
        status: 'Low Stock',
        type: 'supply',
        category: s.category,
        supplier: s.supplier,
      })),
    ]
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);

    // ── Shape recent orders ───────────────────────────────────────
    const formattedRecentOrders = recentOrders.map((o) => ({
      id: o.orderId,
      orderId: o.orderId,
      customer: o.customerName || 'Guest',
      email: o.customerEmail || 'N/A',
      phone: o.customerPhone || 'N/A',
      product:
        o.productName || (o.items && o.items[0]?.name) || 'Custom Order',
      qty: o.quantity || (o.items && o.items[0]?.quantity) || 0,
      amount: `₱${(o.amount || 0).toLocaleString()}`,
      rawAmount: o.amount || 0,
      status: o.status || 'Pending',
      payment: (o.paymentStatus || 'Unpaid').toLowerCase(),
      deliveryMethod: o.receivingMode || 'Pick-up',
      date: o.orderedAt
        ? new Date(o.orderedAt).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : 'N/A',
    }));

    res.json({
      success: true,
      data: {
        stats,
        revenueCategories: revenueCategoryAgg.map((r) => ({
          name: r._id || 'Other',
          revenue: Math.round(r.revenue),
          orders: r.orders,
        })),
        weeklySales,
        lowStockItems,
        recentOrders: formattedRecentOrders,
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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
    const threshold = InventoryItem.threshold;
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

// ─────────────────────────────────────────
// ✅ NEW — GET /admin/sidebar-counts
//
// Single-shot endpoint that returns every count the sidebar badges need.
// Uses the exact same queries/thresholds as /summary so the sidebar and
// dashboard never disagree.
// ─────────────────────────────────────────
router.get('/sidebar-counts', verifyAdminToken, async (req, res) => {
  try {
    const Conversation = require('../models/Conversation.Model');
    const Feedback = require('../models/Feedback.Model');

    const [
      pendingOrders,
      lowStockProductsAgg,
      lowStockSuppliesCount,
      pendingNegotiationsAgg,
      unreadAgg,
      pendingFeedback,
    ] = await Promise.all([
      // 1. Pending orders — same rule as /summary stats.pendingOrders
      Order.countDocuments({ status: 'Pending' }),

      // 2. Low-stock PRODUCT SIZES — same rule as /summary (1..500)
      Product.aggregate([
        { $unwind: '$sizes' },
        { $match: { 'sizes.stock': { $gt: 0, $lte: 500 } } },
        { $count: 'count' },
      ]),

      // 3. Low-stock SUPPLIES — same rule as /summary
      InventoryItem.countDocuments({
        itemType: 'supply',
        stock: { $gt: 0 },
        $expr: { $lte: ['$stock', '$threshold'] },
      }),

      // 4. Pending negotiations — open/in_progress conversations whose
      //    linked order is Pending + Unpaid (same rule as ChatService)
      Conversation.aggregate([
        {
          $match: {
            status: { $in: ['open', 'in_progress'] },
            orderId: { $nin: [null, ''] },
          },
        },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: 'orderId',
            as: 'order',
          },
        },
        { $unwind: '$order' },
        {
          $match: {
            'order.status': 'Pending',
            'order.paymentStatus': 'Unpaid',
          },
        },
        { $count: 'count' },
      ]),

      // 5. Unread messages — sum of adminUnreadCount across all conversations
      Conversation.aggregate([
        { $group: { _id: null, total: { $sum: '$adminUnreadCount' } } },
      ]),

      // 6. Pending feedback
      Feedback.countDocuments({ status: 'pending' }),
    ]);

    const lowStockProducts = lowStockProductsAgg[0]?.count || 0;
    const pendingNegotiations = pendingNegotiationsAgg[0]?.count || 0;
    const unreadMessages = unreadAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        pendingOrders,
        lowStockItems: lowStockProducts + lowStockSuppliesCount,
        pendingNegotiations,
        unreadMessages,
        pendingFeedback,
      },
    });
  } catch (error) {
    console.error('Sidebar counts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;