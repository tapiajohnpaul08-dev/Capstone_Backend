// routes/feedback.routes.js
const express = require('express');
const router = express.Router();
const feedbackController = require('../controller/FeedbackController');
const {
    verifyAdminToken,
    verifyCustomerToken,
} = require('../middleware/authMiddleware');
// ─── Customer Routes ──────────────────────────────────────────────────────

// Submit feedback for an order
router.post('/', verifyCustomerToken, feedbackController.createFeedback);

// Check if feedback exists for an order
router.get('/order/:orderId/check', verifyCustomerToken, feedbackController.checkFeedbackExists);

// Get customer's own feedback
router.get('/my-feedback', verifyCustomerToken, feedbackController.getMyFeedback);

// Get feedback for a specific order
router.get('/order/:orderId', verifyCustomerToken, feedbackController.getFeedbackByOrder);

// Get product feedback (public)
router.get('/product/:productId', feedbackController.getProductFeedback);

// Get product feedback stats (public)
router.get('/product/:productId/stats', feedbackController.getProductFeedbackStats);

// Mark feedback as helpful
router.post('/:feedbackId/helpful', feedbackController.markHelpful);

// ─── Admin Routes ─────────────────────────────────────────────────────────

// Get all feedback (admin)
router.get('/admin/all', verifyAdminToken, feedbackController.getAllFeedback);

// Update feedback status (admin)
router.put('/admin/:feedbackId', verifyAdminToken, feedbackController.updateFeedbackStatus);

// Delete feedback (admin)
router.delete('/admin/:feedbackId', verifyAdminToken, feedbackController.deleteFeedback);

// Get feedback stats (admin)
router.get('/admin/stats', verifyAdminToken, feedbackController.getFeedbackStats);

module.exports = router;