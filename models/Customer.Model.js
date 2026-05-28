// models/Customer.Model.js
const mongoose = require('mongoose');

const designTemplateSchema = new mongoose.Schema({
  templateId: { type: String, required: true, unique: true },
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
    templateDesigns: [designTemplateSchema],
    orders: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        }
    ],  
    provider: { type: String, enum: ['google', 'facebook', 'local'], default: 'local' },
    providerId: { type: String, unique: true, sparse: true },
    profileImage: { type: String, default: null },
    isEmailVerified: { type: Boolean, default: false },
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