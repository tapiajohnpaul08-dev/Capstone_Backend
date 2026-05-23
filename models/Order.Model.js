// models/Order.Model.js
const mongoose = require('mongoose');

const fileMetaSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    size: { type: Number, default: 0 },
    type: { type: String, default: '' },
    path: { type: String, default: '' }   // optional stored path / URL
}, { _id: false });

const designDetailsSchema = new mongoose.Schema({
    designSource: { type: String, enum: ['upload', 'saved'] },
    printSize: { type: String },
    printPlacement: { type: String },
    designNotes: { type: String },
    // Stores one or more uploaded file metadata objects
    files: { type: [fileMetaSchema], default: [] },
    // Stores one or more plain image paths / URLs (e.g. already-saved designs)
    imagePaths: { type: [String], default: [] },
    selectedTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignTemplate' },
    selectedTemplate: {
        id: { type: mongoose.Schema.Types.ObjectId },
        name: String,
        thumbnail: String,
        printSize: String,
        placement: String,
        notes: String
    }
});

const orderItemSchema = new mongoose.Schema({
    productId: { type: Number }, // for company products
    name: { type: String, required: true },
    category: { type: String },
    size: { type: String },
    quantity: { type: Number, required: true },
    designSource: { type: String, enum: ['upload', 'saved'] },
    printSize: { type: String },
    printPlacement: { type: String },
    designNotes: { type: String },
    files: [{ name: String, size: Number, type: String }],
    selectedTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignTemplate' },
    estimatedTotal: { type: Number, default: 0 },
    image: { type: String }
});

const statusHistorySchema = new mongoose.Schema({
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String },
    updatedBy: { type: String }
});

const partialPaymentSchema = new mongoose.Schema({
    amount: { type: Number },
    date: { type: Date, default: Date.now },
    updatedBy: { type: String }
});

const orderSchema = new mongoose.Schema({
    // Order identification
    orderId: { type: String, unique: true }, // Used by service (e.g., generated ID)
    
    // Customer information (from service)
    customerName: { type: String },
    customerEmail: { type: String },
    customerPhone: { type: String },
    address: { type: String },
    customerId: { type: String, ref: 'Customer' }, // Optional reference
    
    // Product information
    productId: { type: String },
    productName: { type: String },
    size: { type: String },
    quantity: { type: Number, required: true },
    
    // Design and order details
    designDetails: [designDetailsSchema],
    items: [orderItemSchema],
    
    // Financial
    amount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 }, // Keeping for compatibility
    
    // Status fields (using service's values)
    status: { 
        type: String, 
        enum: ['Pending', 'Scheduled', 'In Production', 'Out for Delivery', 'Completed', 'Cancelled', 
               'pending', 'design_review', 'approved', 'production', 'completed', 'cancelled'],
        default: 'Pending'
    },
    paymentStatus: { 
        type: String, 
        enum: ['Unpaid', 'Partial', 'Paid'],
        default: 'Unpaid'
    },
    
    // Delivery/Receiving
    receivingMode: { type: String, enum: ['Pick-up', 'Delivery'] },
    deliveryMethod: { type: String, enum: ['Delivery', 'Pick-up'] }, // Keeping for compatibility
    supplyType: { type: String, enum: ['Own Cups', 'Company Cups'] },
    type: { type: String, enum: ['own-cups', 'company-product'] },
    
    // Order source
    isProvided: { type: Boolean, default: false },
    isCartOrder: { type: Boolean, default: false },
    source: { type: String },
    
    // Who placed the order
    orderedBy: { type: String }, // User ID or null for guests
    orderedById: { type: String }, // Keeping for compatibility
    
    // Dates
    expectedDelivery: { type: Date },
    orderedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    
    // Additional info
    notes: { type: String, default: '' },
    
    // History and payments
    statusHistory: [statusHistorySchema],
    partialPayments: [partialPaymentSchema],
    
    // Customer object (for frontend compatibility)
    customer: {
        name: { type: String },
        company: { type: String, default: '' },
        email: { type: String },
        phone: { type: String },
        address: { type: String },
        saveAsDefault: { type: Boolean, default: false }
    },
    
    // Fulfillment object (for frontend compatibility)
    fulfillment: {
        method: { type: String, enum: ['delivery', 'pickup'] },
        deliveryAddress: { type: String, default: '' },
        sameAsCustomer: { type: Boolean, default: false }
    },
    
    // Who last updated
    updatedBy: { type: String }
});



// Index for better query performance
// orderSchema.index({ orderId: 1 });
orderSchema.index({ customerEmail: 1 });
orderSchema.index({ orderedBy: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
// sparse: true excludes null values from the unique constraint, preventing
// E11000 duplicate key errors when orderNumber is not set on an order.
orderSchema.index({ orderNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Order', orderSchema);