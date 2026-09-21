// utils/otpUtils.js
const bcrypt = require('bcrypt');
const { BrevoClient } = require('@getbrevo/brevo');
const Otp = require('../models/Otp.Model');

// ─── Brevo client ───────────────────────────────────────────────────
const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;

const generateOtp = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

/**
 * Send OTP email via Brevo (v6 SDK).
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
    await brevo.transactionalEmails.sendTransacEmail({
      subject: 'Verify Your Email - OTP Code',
      htmlContent: html,
      textContent: `Your OTP for email verification is: ${otp}\n\nValid for ${OTP_TTL_MINUTES} minute(s).`,
      sender: { name: 'ACAPHOP', email: process.env.BREVO_EMAIL_USER },
      to: [{ email }],
    });
    return true;
  } catch (error) {
    console.error('❌ Brevo OTP email failed:', error?.message || error);
    return false;
  }
};

const storeOtp = async (email, otp) => {
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await Otp.deleteMany({ email: email.toLowerCase() });

  await Otp.create({
    email: email.toLowerCase(),
    hashedOtp,
    expiresAt,
    attempts: 0,
  });
};

const verifyOtp = async (email, otp) => {
  const normalizedEmail = email.toLowerCase();
  const record = await Otp.findOne({ email: normalizedEmail });

  if (!record) {
    return { success: false, message: 'OTP not found or expired. Please request a new one.' };
  }

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

  return { success: true, message: 'OTP verified successfully' };
};

const sendOtp = async (email) => {
  const normalizedEmail = email.toLowerCase();

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
  console.log(`OTP for ${email}: ${otp}`);

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