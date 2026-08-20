// services/FeedbackServices.js
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback.Model');
const Order = require('../models/Order.Model');
const Customer = require('../models/Customer.Model');
const generateId = require('../utils/generateItemId');

class FeedbackService {

    // ─── Create Feedback ──────────────────────────────────────────────────
    async createFeedback(payload, user = null) {
        try {
            const {
                orderId,
                rating,
                detailedRatings,
                title,
                comment,
                pros,
                cons,
                wouldRecommend,
                wouldPurchaseAgain,
                isPublic = true
            } = payload;

            // ─── 1. Validate order exists and is completed ──────────────
            const order = await Order.findOne({ orderId });
            if (!order) {
                return { success: false, message: 'Order not found' };
            }

            if (order.status !== 'Completed') {
                return { success: false, message: 'Feedback can only be submitted for completed orders' };
            }

            // ─── 2. Check if feedback already exists ──────────────────────
            const existingFeedback = await Feedback.findOne({ orderId });
            if (existingFeedback) {
                return { success: false, message: 'Feedback already submitted for this order' };
            }

            // ─── 3. Get customer info from user or order ──────────────────
            let customerId = null;
            let customerEmail = order.customerEmail;
            let customerName = order.customerName;

            // ✅ Try to get customer from authenticated user first
            if (user && user._id) {
                const customer = await Customer.findOne({ _id: user._id });
                if (customer) {
                    customerId = customer._id;
                    customerEmail = customer.email;
                    customerName = `${customer.firstName} ${customer.lastName}`;
                    console.log(`✅ Customer found via authenticated user: ${customerEmail} (ID: ${customerId})`);
                } else {
                    console.warn(`⚠️ User authenticated but customer not found: ${user._id}`);
                }
            }

            // ✅ If still no customerId, try to find by email
            if (!customerId && customerEmail) {
                const customer = await Customer.findOne({ email: customerEmail });
                if (customer) {
                    customerId = customer._id;
                    console.log(`✅ Customer found via email: ${customerEmail} (ID: ${customerId})`);
                } else {
                    console.warn(`⚠️ Customer not found for email: ${customerEmail}`);
                }
            }

            // ✅ If still no customerId, create a fallback or return error
            if (!customerId) {
                console.error('❌ No customerId found. User:', user ? user._id : 'null', 'Email:', customerEmail);
                return { success: false, message: 'Customer not found. Please ensure you are logged in.' };
            }

            // ─── 4. Get product info from order ──────────────────────────
            const firstItem = order.items && order.items.length > 0 ? order.items[0] : {};
            const productId = firstItem.productId || null;
            const productName = firstItem.name || null;

            // ─── 5. Generate feedback ID ──────────────────────────────────
            const feedbackId = await generateId('FDBK');

            // ─── 6. Create feedback ──────────────────────────────────────
            const feedback = new Feedback({
                feedbackId,
                orderId,
                customerId, // ✅ Now this will have a valid value
                customerEmail,
                customerName: customerName || order.customerName,
                productId,
                productName,
                rating,
                detailedRatings: detailedRatings || {},
                title: title || null,
                comment: comment || '',
                pros: pros || [],
                cons: cons || [],
                wouldRecommend,
                wouldPurchaseAgain: wouldPurchaseAgain !== undefined ? wouldPurchaseAgain : wouldRecommend,
                isPublic,
                status: 'pending',
                submittedAt: new Date()
            });

            await feedback.save();

            return { success: true, message: 'Feedback submitted successfully', data: feedback };
        } catch (error) {
            console.error('Error creating feedback:', error);
            throw error;
        }
    }

    // ─── Get Feedback by ID ───────────────────────────────────────────────
    async getFeedbackById(feedbackId) {
        try {
            const feedback = await Feedback.findOne({ feedbackId });
            if (!feedback) {
                return { success: false, message: 'Feedback not found' };
            }
            return { success: true, data: feedback };
        } catch (error) {
            console.error('Error getting feedback:', error);
            throw error;
        }
    }

    // ─── Get Feedback by Order ID ─────────────────────────────────────────
    async getFeedbackByOrderId(orderId) {
        try {
            const feedback = await Feedback.findOne({ orderId });
            return { success: true, data: feedback };
        } catch (error) {
            console.error('Error getting feedback by order:', error);
            throw error;
        }
    }

    // ─── Get Feedback by Customer ─────────────────────────────────────────
    async getFeedbackByCustomer(customerId) {
        try {
            const feedbacks = await Feedback.find({ customerId })
                .sort({ submittedAt: -1 });
            return { success: true, data: feedbacks, count: feedbacks.length };
        } catch (error) {
            console.error('Error getting customer feedback:', error);
            throw error;
        }
    }

    // ─── Get Feedback by Product ──────────────────────────────────────────
    async getFeedbackByProduct(productId, limit = 20, page = 1) {
        try {
            const skip = (page - 1) * limit;
            const filter = { 
                productId, 
                status: { $in: ['approved', 'featured'] } 
            };
            
            const [feedbacks, total] = await Promise.all([
                Feedback.find(filter)
                    .sort({ submittedAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Feedback.countDocuments(filter)
            ]);

            return {
                success: true,
                data: feedbacks,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error getting product feedback:', error);
            throw error;
        }
    }

    // ─── Get All Feedback (Admin) ─────────────────────────────────────────
    async getAllFeedback(filters = {}, limit = 20, page = 1) {
        try {
            const query = {};
            
            if (filters.status) query.status = filters.status;
            if (filters.rating) query.rating = parseInt(filters.rating);
            if (filters.productId) query.productId = filters.productId;
            if (filters.customerEmail) {
                query.customerEmail = { $regex: filters.customerEmail, $options: 'i' };
            }
            if (filters.dateFrom) {
                query.submittedAt = { $gte: new Date(filters.dateFrom) };
            }
            if (filters.dateTo) {
                query.submittedAt = { ...query.submittedAt, $lte: new Date(filters.dateTo) };
            }
            if (filters.search) {
                query.$or = [
                    { comment: { $regex: filters.search, $options: 'i' } },
                    { title: { $regex: filters.search, $options: 'i' } },
                    { customerName: { $regex: filters.search, $options: 'i' } }
                ];
            }

            const skip = (page - 1) * limit;
            
            const [feedbacks, total] = await Promise.all([
                Feedback.find(query)
                    .sort({ submittedAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Feedback.countDocuments(query)
            ]);

            return {
                success: true,
                data: feedbacks,
                pagination: {
                    total,
                    page,
                    limit,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error getting all feedback:', error);
            throw error;
        }
    }

    // ─── Update Feedback Status (Admin) ──────────────────────────────────
    async updateFeedbackStatus(feedbackId, status, adminResponse = null, adminName = null) {
        try {
            const validStatuses = ['pending', 'approved', 'rejected', 'featured'];
            if (!validStatuses.includes(status)) {
                return { success: false, message: 'Invalid status' };
            }

            const feedback = await Feedback.findOne({ feedbackId });
            if (!feedback) {
                return { success: false, message: 'Feedback not found' };
            }

            feedback.status = status;
            feedback.updatedAt = new Date();

            if (adminResponse) {
                feedback.adminResponse = {
                    message: adminResponse,
                    respondedAt: new Date(),
                    respondedBy: adminName || 'Admin'
                };
            }

            await feedback.save();

            return { success: true, message: 'Feedback status updated', data: feedback };
        } catch (error) {
            console.error('Error updating feedback status:', error);
            throw error;
        }
    }

    // ─── Mark Helpful ─────────────────────────────────────────────────────
    async markHelpful(feedbackId) {
        try {
            const feedback = await Feedback.findOne({ feedbackId });
            if (!feedback) {
                return { success: false, message: 'Feedback not found' };
            }

            feedback.helpfulCount += 1;
            await feedback.save();

            return { success: true, data: feedback };
        } catch (error) {
            console.error('Error marking feedback helpful:', error);
            throw error;
        }
    }

    // ─── Get Feedback Statistics ──────────────────────────────────────────
    async getFeedbackStats(productId = null) {
        try {
            const filter = { status: { $in: ['approved', 'featured'] } };
            if (productId) filter.productId = productId;

            const [stats, distribution, recent] = await Promise.all([
                Feedback.aggregate([
                    { $match: filter },
                    { 
                        $group: { 
                            _id: null, 
                            avgRating: { $avg: '$rating' },
                            total: { $sum: 1 },
                            fiveStar: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                            fourStar: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
                            threeStar: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
                            twoStar: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
                            oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
                        } 
                    }
                ]),
                Feedback.getRatingDistribution(productId),
                Feedback.find(filter)
                    .sort({ submittedAt: -1 })
                    .limit(5)
                    .lean()
            ]);

            const result = stats[0] || { total: 0, avgRating: 0 };
            
            return {
                success: true,
                data: {
                    averageRating: Math.round(result.avgRating * 100) / 100 || 0,
                    totalReviews: result.total || 0,
                    distribution: {
                        5: result.fiveStar || 0,
                        4: result.fourStar || 0,
                        3: result.threeStar || 0,
                        2: result.twoStar || 0,
                        1: result.oneStar || 0
                    },
                    recent: recent || []
                }
            };
        } catch (error) {
            console.error('Error getting feedback stats:', error);
            throw error;
        }
    }

    // ─── Delete Feedback ──────────────────────────────────────────────────
    async deleteFeedback(feedbackId) {
        try {
            const feedback = await Feedback.findOneAndDelete({ feedbackId });
            if (!feedback) {
                return { success: false, message: 'Feedback not found' };
            }
            return { success: true, message: 'Feedback deleted successfully' };
        } catch (error) {
            console.error('Error deleting feedback:', error);
            throw error;
        }
    }
}

module.exports = new FeedbackService();