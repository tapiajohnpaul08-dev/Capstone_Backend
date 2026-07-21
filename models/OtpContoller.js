const { sendOtp, verifyOtp } = require('../utils/otpUtils');
const asyncTryCatch = require('../utils/tryAndCatch');

class OtpController {
    
    /**
     * Send OTP for registration
     * POST /api/otp/send
     */
    sendRegistrationOtp = asyncTryCatch(async (req, res, next) => {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        
        const result = await sendOtp(email);
        const status = result.success ? 200 : 400;
        
        res.status(status).json(result);
    });
    
    /**
     * Verify OTP (separate endpoint if needed)
     * POST /api/otp/verify
     */
    verifyOtpOnly = asyncTryCatch(async (req, res, next) => {
        const { email, otp } = req.body;
        
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }
        
        const result = await verifyOtp(email, otp);
        const status = result.success ? 200 : 400;
        
        res.status(status).json(result);
    });
}

module.exports = new OtpController();