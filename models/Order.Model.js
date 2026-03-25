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
                type: String  // Store the ID as string (Admin ID or Customer ID)
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
                type: String  // Store the ID as string
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
    // Store the ID of who placed the order (Admin ID or Customer ID)
    orderedBy: {
        type: String,
        required: true,
        index: true
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
        type: String  // Store the ID of who last updated
    },
    notes: {
        type: String,
        trim: true
    }
});

// Indexes for better query performance
orderSchema.index({ customerEmail: 1, orderedAt: -1 });
orderSchema.index({ status: 1, orderedAt: -1 });
orderSchema.index({ orderedBy: 1, orderedAt: -1 });
orderSchema.index({ expectedDelivery: 1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;