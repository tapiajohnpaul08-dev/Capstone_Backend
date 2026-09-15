// utils/otpUtils.js
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const Otp = require('../models/Otp.Model');

// ─── Email transporter ─────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const OTP_TTL_MINUTES = 1;        // must match the email copy below
const OTP_MAX_ATTEMPTS = 3;

/**
 * Generate a random numeric OTP
 * @param {number} length - default 6
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
 */
const sendOtpEmail = async (email, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Email Verification</h2>
      <p>Thank you for registering! Please use the following OTP to verify your email address:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; background: #f0f0f0; padding: 10px 20px; border-radius: 5px;">${otp}</span>
      </div>
      <p style="color: #666; font-size: 14px;">This OTP is valid for ${OTP_TTL_MINUTES} minute${OTP_TTL_MINUTES > 1 ? 's' : ''}.</p>
      <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"ACAPHOP" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - OTP Code',
      html,
      text: `Your OTP for email verification is: ${otp}\n\nValid for ${OTP_TTL_MINUTES} minute(s).`,
    });
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

/**
 * Store OTP in MongoDB with hashed value + TTL expiry
 */
const storeOtp = async (email, otp) => {
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Delete any existing OTP for this email (only one active at a time)
  await Otp.deleteMany({ email: email.toLowerCase() });

  await Otp.create({
    email: email.toLowerCase(),
    hashedOtp,
    expiresAt,
    attempts: 0,
  });
};

/**
 * Verify OTP
 * @returns {Promise<{success: boolean, message: string}>}
 */
const verifyOtp = async (email, otp) => {
  const normalizedEmail = email.toLowerCase();
  const record = await Otp.findOne({ email: normalizedEmail });

  if (!record) {
    return { success: false, message: 'OTP not found or expired. Please request a new one.' };
  }

  // MongoDB TTL will delete it, but we double-check in case of replication lag
  if (record.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: record._id });
    return { success: false, message: 'OTP has expired. Please request a new one.' };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }

  const isValid = await bcrypt.compare(otp, record.hashedOtp);
  console.log(`Verifying OTP for ${email}:`, { otp, isValid });

  if (!isValid) {
    record.attempts += 1;
    await record.save();
    const remaining = OTP_MAX_ATTEMPTS - record.attempts;
    return { success: false, message: `Invalid OTP. ${remaining} attempts remaining.` };
  }

  // Valid → do NOT delete yet (register flow may need it again briefly).
  // The register endpoint will call this and then proceed; expiry will clean up.
  return { success: true, message: 'OTP verified successfully' };
};

/**
 * Send OTP to email (combined utility)
 */
const sendOtp = async (email) => {
  const normalizedEmail = email.toLowerCase();

  // Prevent spam: if a valid OTP was created less than 60s ago, reject
  const existing = await Otp.findOne({ email: normalizedEmail });
  if (existing && existing.createdAt) {
    const secondsSinceCreation = (Date.now() - existing.createdAt.getTime()) / 1000;
    if (secondsSinceCreation < 60) {
      const remaining = Math.ceil(60 - secondsSinceCreation);
      return {
        success: false,
        message: `Please wait ${remaining} seconds before requesting a new OTP`,
      };
    }
  }

  const otp = generateOtp(6);
  console.log(`OTP for ${email}: ${otp}`); // For testing

  const emailSent = await sendOtpEmail(email, otp);

  if (!emailSent) {
    return { success: false, message: 'Failed to send OTP email. Please try again.' };
  }

  await storeOtp(email, otp);

  return {
    success: true,
    message: `OTP sent successfully. Valid for ${OTP_TTL_MINUTES} minute(s).`,
    ...(process.env.NODE_ENV !== 'production' && { debugOtp: otp }),
  };
};

module.exports = { sendOtp, verifyOtp };