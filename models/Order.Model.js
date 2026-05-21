// models/Order.Model.js
const mongoose = require('mongoose');

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
    files: [{ name: String, url: String, size: Number }],
    selectedTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignTemplate' }
});

const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },
    customerId: { type: String, required: true, ref: 'Customer' },
    type: { type: String, enum: ['own-cups', 'company-product'] },
    supplyType: { type: String, enum: ['Own Cups', 'Company Cups'] },
    deliveryMethod: { type: String, enum: ['Delivery', 'Pick-up'] },
    totalAmount: { type: Number, default: 0 },
    status: { 
        type: String, 
        enum: ['pending', 'design_review', 'approved', 'production', 'completed', 'cancelled'],
        default: 'pending'
    },
    items: [orderItemSchema],
    customer: {
        name: String,
        email: String,
        phone: String,
        address: String,
        company: String
    },
    fulfillment: {
        method: { type: String, enum: ['delivery', 'pickup'] },
        deliveryAddress: String,
        sameAsCustomer: Boolean
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);