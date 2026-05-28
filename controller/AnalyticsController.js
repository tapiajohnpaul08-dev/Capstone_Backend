// controller/AnalyticsController.js
const analyticsService = require('../services/AnalyticsServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class AnalyticsController {

    getAnalyticsStats = asyncTryCatch(async (req, res) => {
        const { date_from, date_to } = req.query;
        const response = await analyticsService.getAnalyticsStats(date_from, date_to);
        res.status(200).json(response);
    });

    getTopProducts = asyncTryCatch(async (req, res) => {
        const limit = parseInt(req.query.limit) || 5;
        const { date_from, date_to } = req.query;
        const response = await analyticsService.getTopProducts(limit, date_from, date_to);
        res.status(200).json(response);
    });

    getOrderStatusDistribution = asyncTryCatch(async (req, res) => {
        const { date_from, date_to } = req.query;
        const response = await analyticsService.getOrderStatusDistribution(date_from, date_to);
        res.status(200).json(response);
    });

    getRevenueByCategory = asyncTryCatch(async (req, res) => {
        const { date_from, date_to } = req.query;
        const response = await analyticsService.getRevenueByCategory(date_from, date_to);
        res.status(200).json(response);
    });

    getMonthlyRevenueTrend = asyncTryCatch(async (req, res) => {
        const months = parseInt(req.query.months) || 12;
        const response = await analyticsService.getMonthlyRevenueTrend(months);
        res.status(200).json(response);
    });

    getFilteredAnalytics = asyncTryCatch(async (req, res) => {
        const { date_from, date_to, group_by } = req.query;
        const response = await analyticsService.getFilteredAnalytics(date_from, date_to, group_by);
        res.status(200).json(response);
    });

    getRevenueForecast = asyncTryCatch(async (req, res) => {
        const response = await analyticsService.getRevenueForecast();
        res.status(200).json(response);
    });

    getLowStockProducts = asyncTryCatch(async (req, res) => {
        const threshold = parseInt(req.query.threshold) || 500;
        const response = await analyticsService.getLowStockProducts(threshold);
        res.status(200).json(response);
    });

    getTopCustomers = asyncTryCatch(async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const response = await analyticsService.getTopCustomers(limit);
        res.status(200).json(response);
    });
}

module.exports = new AnalyticsController();