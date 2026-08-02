// models/Driver.Model.js
const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
    driverId: {
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
        trim: true,
        default: ''
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
        lowercase: true,
        index: true
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    password: {
        type: String,
        required: true
    },
    // Manual availability (set by admin)
    available: {
        type: Boolean,
        default: true
    },
    // Track assigned orders count
    assignedOrdersCount: {
        type: Number,
        default: 0
    },
    plateNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        index: true
    },
    vehicleDescription: {
        type: String,
        trim: true,
        default: ''
    },
    lastLogin: {
        type: Date,
        default: null
    },
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


// Virtual for full name
driverSchema.virtual('fullName').get(function() {
    const middle = this.middleName ? ` ${this.middleName} ` : ' ';
    return `${this.firstName}${middle}${this.lastName}`;
});

// Virtual for display name
driverSchema.virtual('displayName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual to check if driver is available for assignment
driverSchema.virtual('isAvailableForAssignment').get(function() {
    return this.available === true;
});

// Ensure virtuals are included in JSON output
driverSchema.set('toJSON', { virtuals: true });
driverSchema.set('toObject', { virtuals: true });

// Index for faster queries
driverSchema.index({ available: 1, plateNumber: 1 });

const Driver = mongoose.model('Driver', driverSchema);
module.exports = Driver;