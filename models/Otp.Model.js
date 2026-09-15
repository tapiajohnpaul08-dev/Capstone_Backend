// models/Otp.Model.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  hashedOtp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ─── TTL index ─────────────────────────────────────────────────────────
// MongoDB automatically deletes documents when `expiresAt` is reached.
// expireAfterSeconds: 0 means "delete at the time stored in expiresAt".
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for fast lookup: find by email, newest first
otpSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('Otp', otpSchema);