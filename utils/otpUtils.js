const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

// In-memory OTP store (use Redis in production)
const otpStore = new Map();

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Generate a random OTP
 * @param {number} length - OTP length (default: 6)
 * @returns {string}
 */
const generateOtp = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
};

/**
 * Send OTP email
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code
 * @returns {Promise<boolean>}
 */
const sendOtpEmail = async (email, otp) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Thank you for registering! Please use the following OTP to verify your email address:</p>
            <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f0f0f0; padding: 10px 20px; border-radius: 5px;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This OTP is valid for 10 minutes.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"Your App" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your Email - OTP Code',
            html: html,
            text: `Your OTP for email verification is: ${otp}\n\nValid for 10 minutes.`
        });
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        return false;
    }
};

/**
 * Store OTP with hashed value
 * @param {string} email - User email
 * @param {string} otp - Plain OTP
 */
const storeOtp = async (email, otp) => {
    const saltRounds = 10;
    const hashedOtp = await bcrypt.hash(otp, saltRounds);
    const expiresAt = Date.now() + 1 * 60 * 1000; // Changed to 1 minute
    
    otpStore.set(email, {
        hashedOtp,
        expiresAt,
        attempts: 0
    });
    
    // Auto cleanup after expiry (1 minute)
    setTimeout(() => {
        if (otpStore.has(email) && otpStore.get(email).expiresAt <= Date.now()) {
            otpStore.delete(email);
        }
    }, 1 * 60 * 1000);
};

/**
 * Verify OTP
 * @param {string} email - User email
 * @param {string} otp - OTP to verify
 * @returns {Promise<{success: boolean, message: string}>}
 */
const verifyOtp = async (email, otp) => {
    const stored = otpStore.get(email);
    
    if (!stored) {
        return { success: false, message: 'OTP not found or expired. Please request a new one.' };
    }
    
    if (stored.expiresAt < Date.now()) {
        otpStore.delete(email);
        return { success: false, message: 'OTP has expired. Please request a new one.' };
    }
    
    if (stored.attempts >= 3) {
        otpStore.delete(email);
        return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
    }
    
    const isValid = await bcrypt.compare(otp, stored.hashedOtp);
    
    if (!isValid) {
        stored.attempts++;
        otpStore.set(email, stored);
        return { success: false, message: `Invalid OTP. ${3 - stored.attempts} attempts remaining.` };
    }
    
    // OTP is valid, remove it
    otpStore.delete(email);
    return { success: true, message: 'OTP verified successfully' };
};

/**
 * Send OTP to email (combined utility function)
 * @param {string} email - Recipient email
 * @returns {Promise<{success: boolean, message: string, otp?: string}>}
 */
const sendOtp = async (email) => {
    // Check if there's already a valid OTP
    const existing = otpStore.get(email);
    if (existing && existing.expiresAt > Date.now()) {
        const remainingSeconds = Math.ceil((existing.expiresAt - Date.now()) / 1000);
        return {
            success: false,
            message: `Please wait ${remainingSeconds} seconds before requesting a new OTP`
        };
    }
    
    const otp = generateOtp(6);
    console.log(`OTP for ${email}: ${otp}`); // For testing
    
    const emailSent = await sendOtpEmail(email, otp);
    
    if (!emailSent) {
        return {
            success: false,
            message: 'Failed to send OTP email. Please try again.'
        };
    }
    
    await storeOtp(email, otp);
    
    return {
        success: true,
        message: 'OTP sent successfully. Valid for 1 minute.',
        ...(process.env.NODE_ENV !== 'production' && { debugOtp: otp })
    };
};

module.exports = {
    sendOtp,
    verifyOtp
};