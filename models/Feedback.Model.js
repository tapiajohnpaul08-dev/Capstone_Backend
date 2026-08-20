// models/Feedback.Model.js
const mongoose = require('mongoose');

/**
 * Customer Feedback Schema
 * Captures customer insights after order completion
 */
const feedbackSchema = new mongoose.Schema({
    // Unique identifier
    feedbackId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Order reference
    orderId: {
        type: String,
        required: true,
        index: true,
        ref: 'Order'
    },
    
    // Customer reference
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true
    },
    
    // Customer email (denormalized for quick lookup)
    customerEmail: {
        type: String,
        required: true,
        index: true
    },
    
    customerName: {
        type: String,
        required: true
    },
    
    // Product reference (if feedback is for a specific product)
    productId: {
        type: String,
        index: true
    },
    
    productName: {
        type: String
    },
    
    // ─── Ratings (1-5 stars) ──────────────────────────────────────────────
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: {
            validator: Number.isInteger,
            message: 'Rating must be a whole number between 1 and 5'
        }
    },
    
    // ─── Detailed Ratings ──────────────────────────────────────────────────
    detailedRatings: {
        quality: { type: Number, min: 1, max: 5, default: null },
        design: { type: Number, min: 1, max: 5, default: null },
        packaging: { type: Number, min: 1, max: 5, default: null },
        delivery: { type: Number, min: 1, max: 5, default: null },
        valueForMoney: { type: Number, min: 1, max: 5, default: null },
        customerService: { type: Number, min: 1, max: 5, default: null }
    },
    
    // ─── Text Feedback ─────────────────────────────────────────────────────
    title: {
        type: String,
        trim: true,
        maxlength: 100
    },
    
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    
    // ─── Pros & Cons ──────────────────────────────────────────────────────
    pros: [{
        type: String,
        trim: true,
        maxlength: 500
    }],
    
    cons: [{
        type: String,
        trim: true,
        maxlength: 500
    }],
    
    // ─── Would Recommend ───────────────────────────────────────────────────
    wouldRecommend: {
        type: Boolean,
        default: null
    },
    
    wouldPurchaseAgain: {
        type: Boolean,
        default: null
    },
    
    // ─── Status ────────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'featured'],
        default: 'pending'
    },
    
    // ─── Admin Response ────────────────────────────────────────────────────
    adminResponse: {
        message: { type: String, trim: true, maxlength: 1000 },
        respondedAt: { type: Date },
        respondedBy: { type: String }
    },
    
    // ─── Timestamps ────────────────────────────────────────────────────────
    submittedAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    },
    
    // ─── Metadata ──────────────────────────────────────────────────────────
    isPublic: {
        type: Boolean,
        default: true
    },
    
    isVerified: {
        type: Boolean,
        default: false
    },
    
    helpfulCount: {
        type: Number,
        default: 0
    }
});

// ─── Indexes ──────────────────────────────────────────────────────────────
feedbackSchema.index({ orderId: 1, customerId: 1 });
feedbackSchema.index({ rating: -1 });
feedbackSchema.index({ status: 1, submittedAt: -1 });
feedbackSchema.index({ productId: 1, rating: -1 });
feedbackSchema.index({ customerEmail: 1, submittedAt: -1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────
feedbackSchema.virtual('overallRating').get(function() {
    const ratings = [
        this.detailedRatings?.quality,
        this.detailedRatings?.design,
        this.detailedRatings?.packaging,
        this.detailedRatings?.delivery,
        this.detailedRatings?.valueForMoney,
        this.detailedRatings?.customerService
    ].filter(r => r !== null && r !== undefined);
    
    if (ratings.length === 0) return this.rating;
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
});

// ─── Methods ──────────────────────────────────────────────────────────────
feedbackSchema.methods.getStatusLabel = function() {
    const labels = {
        'pending': 'Pending Review',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'featured': 'Featured'
    };
    return labels[this.status] || this.status;
};

feedbackSchema.methods.isPositive = function() {
    return this.rating >= 4;
};

feedbackSchema.methods.isNeutral = function() {
    return this.rating === 3;
};

feedbackSchema.methods.isNegative = function() {
    return this.rating <= 2;
};

// ─── Statics ──────────────────────────────────────────────────────────────
feedbackSchema.statics.getAverageRating = async function(productId = null) {
    const filter = { status: { $in: ['approved', 'featured'] } };
    if (productId) filter.productId = productId;
    
    const result = await this.aggregate([
        { $match: filter },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    
    return {
        average: result[0]?.avgRating || 0,
        count: result[0]?.count || 0
    };
};

feedbackSchema.statics.getRatingDistribution = async function(productId = null) {
    const filter = { status: { $in: ['approved', 'featured'] } };
    if (productId) filter.productId = productId;
    
    const distribution = await this.aggregate([
        { $match: filter },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);
    
    const result = {};
    for (let i = 1; i <= 5; i++) {
        const found = distribution.find(d => d._id === i);
        result[i] = found?.count || 0;
    }
    return result;
};

feedbackSchema.statics.getRecentFeedback = async function(limit = 10, productId = null) {
    const filter = { status: { $in: ['approved', 'featured'] } };
    if (productId) filter.productId = productId;
    
    return this.find(filter)
        .sort({ submittedAt: -1 })
        .limit(limit)
        .populate('orderId', 'orderId orderNumber')
        .lean();
};

const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;