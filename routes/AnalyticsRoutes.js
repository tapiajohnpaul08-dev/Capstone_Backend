// routes/AnalyticsRoutes.js
const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controller/AnalyticsController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

router.use(verifyAdminToken);

router.get('/stats',                    AnalyticsController.getAnalyticsStats);
router.get('/top-products',             AnalyticsController.getTopProducts);
router.get('/order-status-distribution',AnalyticsController.getOrderStatusDistribution);
router.get('/revenue-by-category',      AnalyticsController.getRevenueByCategory);
router.get('/monthly-revenue',          AnalyticsController.getMonthlyRevenueTrend);
router.get('/filter',                   AnalyticsController.getFilteredAnalytics);
router.get('/forecast',                 AnalyticsController.getRevenueForecast);
router.get('/products/low-stock',       AnalyticsController.getLowStockProducts);
router.get('/customers/top',            AnalyticsController.getTopCustomers);

module.exports = router;