// utils/otpUtils.js
const bcrypt = require('bcrypt');
const { Resend } = require('resend');
const Otp = require('../models/Otp.Model');

const resend = new Resend(process.env.RESEND_API_KEY);

// The "from" address must be:
//   - A verified domain (e.g., "ACAPHOP <noreply@acaphop.com>"), OR
//   - Resend's onboarding address for testing: "onboarding@resend.dev"
const FROM_ADDRESS = process.env.RESEND_FROM
  || 'ACAPHOP <onboarding@resend.dev>';

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
  const html = `...`;

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: 'Verify Your Email - OTP Code',
      html,
      text: `Your OTP for email verification is: ${otp}\n\nValid for ${OTP_TTL_MINUTES} minute(s).`,
    });
    if (result.error) {
      console.error('Resend error:', result.error);
      return false;
    }
    console.log('✅ OTP email sent via Resend:', result.data?.id);
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