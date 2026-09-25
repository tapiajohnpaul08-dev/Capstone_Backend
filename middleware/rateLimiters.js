// middleware/rateLimiters.js
//
// Centralized rate limiters. Kept in one file so the thresholds can be
// audited and tuned in a single place, and so every route uses the same
// response shape ({ success: false, message }) the rest of the API uses.
//
// express-rate-limit keys by IP by default. `app.set('trust proxy', 1)`
// in server.js means req.ip reflects the real client even behind Render's
// reverse proxy, so the limits are per-user, not per-proxy.

const rateLimit = require('express-rate-limit')

const msg = (text) => ({ success: false, message: text })

// ─── AUTH: strict, failures only ───────────────────────────────────────
// Applied to every login / register / password-reset endpoint. Uses
// skipSuccessfulRequests so a legitimate user logging in repeatedly
// doesn't burn through the quota — only failed attempts count.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                     // 10 failures per IP per window
  message: msg('Too many login attempts. Please try again in 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
})

// ─── UPLOAD: cap the flood of file uploads ─────────────────────────────
// Applied to every endpoint that accepts multipart/form-data. 30/min is
// generous for legitimate use (an admin uploading product images, a
// customer submitting a design) but blocks scripted abuse of Cloudinary.
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 30,
  message: msg('Too many uploads. Please slow down and try again shortly.'),
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── ALERT: prevent email-bombing the notification endpoints ───────────
// The alert endpoints trigger transactional emails. Without a limiter,
// a stuck admin UI or a malicious actor could send thousands of emails
// and burn through the Brevo quota (or get the account flagged).
const alertLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 minutes
  max: 10,
  message: msg('Too many alert requests. Please wait before sending more.'),
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── OTP: mirrors the existing limiter in OtpRoutes.js ────────────────
// Exported here so OTP-related routes outside OtpRoutes can reuse the
// same threshold. OtpRoutes.js already has its own copy — leave that one.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 3,
  message: msg('Too many OTP requests. Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = {
  authLimiter,
  uploadLimiter,
  alertLimiter,
  otpLimiter,
}