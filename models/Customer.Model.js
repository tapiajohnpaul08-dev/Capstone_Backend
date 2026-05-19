const mongoose = require('mongoose');

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
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowecase: true,
        index: true
    },
    companyName:{
        type: String,
        default: null,
    },   
    password: {
        type: String,
    },
    templateDesigns: [
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
    orders: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        }
    ],  

    // OAuth fields
    provider: { type: String, enum: ['google', 'facebook', 'local'], default: 'local' },
    providerId: { type: String, unique: true, sparse: true },
    profileImage: { type: String, default: null },
    isEmailVerified: { type: Boolean, default: false },

    createdAt: {
        type: Date,
        default: Date.now,  // Real Date object, not a string
        immutable: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Customer = mongoose.model('Customer', customerSchema);
module.exports = Customer;