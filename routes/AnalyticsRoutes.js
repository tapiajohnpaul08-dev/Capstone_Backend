// routes/AnalyticsRoutes.js
const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controller/AnalyticsController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// All analytics routes require admin authentication
router.use(verifyAdminToken);

router.get('/stats', AnalyticsController.getAnalyticsStats);
router.get('/top-products', AnalyticsController.getTopProducts);
router.get('/order-status-distribution', AnalyticsController.getOrderStatusDistribution);
router.get('/revenue-by-category', AnalyticsController.getRevenueByCategory);
router.get('/monthly-revenue', AnalyticsController.getMonthlyRevenueTrend);

// In AnalyticsRoutes.js
router.get('/debug-monthly', AnalyticsController.debugMonthlyRevenue);

module.exports = router;