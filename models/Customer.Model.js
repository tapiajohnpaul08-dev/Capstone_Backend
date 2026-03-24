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
    userName: {
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
        lowercase: true,
        index: true
    },
    password: {
        type: String,
        required: true  // Store only hashed passwords (e.g. bcrypt) — never plain text
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