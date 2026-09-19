// models/Customer.Model.js
const mongoose = require('mongoose');

const designTemplateSchema = new mongoose.Schema({
  templateId: { 
    type: String, 
    required: true, 
    sparse: true // This should be at the field level, not the schema level
  },
  name: { type: String, required: true },
  imagePath: { type: String, required: true },
  printSize: { type: String, default: '' },
  placement: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const customerSchema = new mongoose.Schema({
    customerId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    middleName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    status: {type: String, enum:['Active','Offline']},
    phone: { type: String, default: '' },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true
    },
    companyName:{
        type: String,
        default: null,
    },   
    password: {
        type: String,
    },
    templateDesigns: {
        type: [designTemplateSchema],
        default: [],
    },

    // ✅ NEW — Saved addresses for future orders
    addresses: {
        type: [new mongoose.Schema({
            label: { type: String, default: '' },      // "Home", "Office", etc.
            streetAddress: { type: String, default: '' },
            barangay: { type: String, default: '' },
            municipality: { type: String, default: '' },
            province: { type: String, default: '' },
            postalCode: { type: String, default: '' },
            region: { type: String, default: '' },
            country: { type: String, default: 'Philippines' },
            isDefault: { type: Boolean, default: false },
            createdAt: { type: Date, default: Date.now },
        }, { _id: true })],
        default: [],
    },

    orders: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        }
    ],  
    totalSpent: {type: Number, default: 0},
    provider: { type: String, enum: ['google', 'facebook', 'local'], default: 'local' },
    providerId: { type: String, unique: true, sparse: true },
    profileImage: { type: String, default: null },
    isEmailVerified: { type: Boolean, default: false },
    marketingComs: { type: Boolean, default: false },
    dataSharing: { type: Boolean, default: false },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});



const Customer = mongoose.model('Customer', customerSchema);
module.exports = Customer;