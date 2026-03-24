const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    adminId: {
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
    role: {
        type: String,
        required: true,
        enum: ['Sales', 'Production']
    },
    lastLogin: {
        type: Date,
        default: null
    },
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

// Auto-update updatedAt on every save
adminSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Full name virtual
adminSchema.virtual('fullName').get(function () {
    const middle = this.middleName ? ` ${this.middleName} ` : ' ';
    return `${this.firstName}${middle}${this.lastName}`;
});

// Instance method: record login timestamp
adminSchema.methods.recordLogin = async function () {
    this.lastLogin = new Date();
    await this.save();
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;