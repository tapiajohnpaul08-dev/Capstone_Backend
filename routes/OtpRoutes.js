const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const OtpController = require('../controller/OtpContoller');

// Rate limiting for OTP requests (max 3 requests per 10 minutes per IP)
const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // limit each IP to 3 OTP requests per windowMs
    message: {
        success: false,
        message: 'Too many OTP requests. Please try again later.'
    }
});

// OTP routes with rate limiting
router.post('/send', otpLimiter, OtpController.sendRegistrationOtp);
router.post('/verify', OtpController.verifyOtpOnly);

module.exports = router;