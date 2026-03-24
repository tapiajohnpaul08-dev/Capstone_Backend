// models/Order.Model.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    customerEmail: {
        type: String,
        required: true,
        index: true
    },
    address: {
        type: String,
        required: true,
    },
    productId: {
        type: String,
        required: true
    },
    size: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    designDetails: [
        {
            logoImageUrl: {
                type: String,
                required: true,
            },
            printSize: {
                type: String,
                required: true,
            },
            placement: {
                type: String,
                required: true,
            },
            notes: {
                type: String,
                trim: true
            },
        },
    ],
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Scheduled', 'In Production', 'Out for Delivery', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    statusHistory: [
        {
            status: {
                type: String,
                enum: ['Pending', 'Scheduled', 'In Production', 'Out for Delivery', 'Completed', 'Cancelled'],
                default: 'Pending'
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            notes: {
                type: String,
                trim: true
            },
            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                refPath: 'statusHistory.updatedByModel'
            },
            updatedByModel: {
                type: String,
                enum: ['Admin', 'Customer']
            }
        }
    ],
    paymentStatus: {
        type: String,
        required: true,
        enum: ['Paid', 'Partial', 'Unpaid'],
        default: 'Unpaid'
    },
    partialPayments: [
        {
            amount: {
                type: Number,
                required: true
            },
            date: {
                type: Date,
                default: Date.now
            },
            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                refPath: 'partialPayments.updatedByModel'
            },
            updatedByModel: {
                type: String,
                enum: ['Admin', 'Customer']
            }
        }
    ],
    receivingMode: {
        type: String,
        required: true,
        enum: ['Delivery', 'Pickup']
    },
    expectedDelivery: {
        type: Date,
        required: true
    },
    isProvided: {
        type: Boolean,
        required: true,
        default: true
    },
    // Polymorphic field for who placed the order (can be Admin or Customer)
    orderedBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'orderedByModel'
    },
    orderedAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'updatedByModel'
    },
    updatedByModel: {
        type: String,
        enum: ['Sales','Production', 'Customer']
    },
    notes: {
        type: String,
        trim: true
    }
}, { timestamps: true });

// Indexes for better query performance
orderSchema.index({ customerEmail: 1, orderedAt: -1 });
orderSchema.index({ status: 1, orderedAt: -1 });
orderSchema.index({ orderedBy: 1, orderedByModel: 1 });
orderSchema.index({ expectedDelivery: 1 });

// // Virtual to get ordered by details
// orderSchema.virtual('orderedByDetails', {
//     refPath: 'orderedByModel',
//     localField: 'orderedBy',
//     foreignField: '_id',
//     justOne: true
// });

// // Virtual to get updated by details
// orderSchema.virtual('updatedByDetails', {
//     refPath: 'updatedByModel',
//     localField: 'updatedBy',
//     foreignField: '_id',
//     justOne: true
// });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;