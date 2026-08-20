// controllers/feedback.controller.js
const FeedbackService = require('../services/FeedbackServices');

class FeedbackController {

    // ─── Create Feedback ──────────────────────────────────────────────────
    async createFeedback(req, res) {
        try {
            const result = await FeedbackService.createFeedback(req.body, req.user);
            
            if (!result.success) {
                return res.status(400).json(result);
            }
            
            res.status(201).json(result);
        } catch (error) {
            console.error('Error creating feedback:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Check Feedback Exists ────────────────────────────────────────────
    async checkFeedbackExists(req, res) {
        try {
            const { orderId } = req.params;
            const result = await FeedbackService.getFeedbackByOrderId(orderId);
            res.json({ exists: !!result.data });
        } catch (error) {
            console.error('Error checking feedback:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Get Customer's Feedback ──────────────────────────────────────────
    async getMyFeedback(req, res) {
        try {
            const result = await FeedbackService.getFeedbackByCustomer(req.user._id);
            res.json(result);
        } catch (error) {
            console.error('Error getting customer feedback:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Get Feedback by Order ────────────────────────────────────────────
    async getFeedbackByOrder(req, res) {
        try {
            const { orderId } = req.params;
            const result = await FeedbackService.getFeedbackByOrderId(orderId);
            res.json(result);
        } catch (error) {
            console.error('Error getting order feedback:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Get Product Feedback (Public) ────────────────────────────────────
    async getProductFeedback(req, res) {
        try {
            const { productId } = req.params;
            const { limit = 20, page = 1 } = req.query;
            
            const result = await FeedbackService.getFeedbackByProduct(
                productId,
                parseInt(limit),
                parseInt(page)
            );
            
            res.json(result);
        } catch (error) {
            console.error('Error getting product feedback:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Get Product Feedback Stats (Public) ──────────────────────────────
    async getProductFeedbackStats(req, res) {
        try {
            const { productId } = req.params;
            const result = await FeedbackService.getFeedbackStats(productId);
            res.json(result);
        } catch (error) {
            console.error('Error getting feedback stats:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Mark Feedback as Helpful ─────────────────────────────────────────
    async markHelpful(req, res) {
        try {
            const { feedbackId } = req.params;
            const result = await FeedbackService.markHelpful(feedbackId);
            res.json(result);
        } catch (error) {
            console.error('Error marking helpful:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Admin: Get All Feedback ──────────────────────────────────────────
    async getAllFeedback(req, res) {
        try {
            const { limit = 20, page = 1, ...filters } = req.query;
            
            const result = await FeedbackService.getAllFeedback(
                filters,
                parseInt(limit),
                parseInt(page)
            );
            
            res.json(result);
        } catch (error) {
            console.error('Error getting all feedback:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Admin: Update Feedback Status ────────────────────────────────────
    async updateFeedbackStatus(req, res) {
        try {
            const { feedbackId } = req.params;
            const { status, adminResponse } = req.body;
            
            const adminName = req.user?.firstName 
                ? `${req.user.firstName} ${req.user.lastName}` 
                : 'Admin';
            
            const result = await FeedbackService.updateFeedbackStatus(
                feedbackId,
                status,
                adminResponse,
                adminName
            );
            
            res.json(result);
        } catch (error) {
            console.error('Error updating feedback status:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Admin: Delete Feedback ───────────────────────────────────────────
    async deleteFeedback(req, res) {
        try {
            const { feedbackId } = req.params;
            const result = await FeedbackService.deleteFeedback(feedbackId);
            res.json(result);
        } catch (error) {
            console.error('Error deleting feedback:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // ─── Admin: Get Feedback Stats ────────────────────────────────────────
    async getFeedbackStats(req, res) {
        try {
            const result = await FeedbackService.getFeedbackStats();
            res.json(result);
        } catch (error) {
            console.error('Error getting feedback stats:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
}

module.exports = new FeedbackController();