const jwt = require('jsonwebtoken');
const passport = require('../config/passport');
const asyncTryCatch = require('../utils/tryAndCatch');

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'; 

class OAuthController {
    
    /**
     * Initiate Google OAuth
     * GET /api/v1/auth/google
     */
    googleAuth = (req, res, next) => {
        passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
    };
    
    /**
     * Google OAuth Callback
     * GET /api/v1/auth/google/callback
     */
    googleCallback = (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, profile) => {
        if (err || !profile) {
            console.error('Google auth error:', err);
            return res.redirect(`${FRONTEND_URL}/customer/login?error=auth_failed`);
        }
        
        const token = profile.authToken;
        const userData = encodeURIComponent(JSON.stringify(profile.userData));
        
        // Redirect to frontend with token
        return res.redirect(`${FRONTEND_URL}/customer/login?token=${token}&user=${userData}`);
    })(req, res, next);
};
    
    /**
     * Initiate Facebook OAuth
     * GET /api/v1/auth/facebook
     */
    facebookAuth = (req, res, next) => {
        passport.authenticate('facebook', { scope: ['email', 'public_profile'] })(req, res, next);
    };
    
    /**
     * Facebook OAuth Callback
     * GET /api/v1/auth/facebook/callback
     */
    facebookCallback = (req, res, next) => {
    passport.authenticate('facebook', { session: false }, (err, profile) => {
        if (err || !profile) {
            console.error('Facebook auth error:', err);
            return res.redirect(`${FRONTEND_URL}/customer/login?error=auth_failed`);
        }
        
        const token = profile.authToken;
        const userData = encodeURIComponent(JSON.stringify(profile.userData));
        
        // Redirect to frontend with token
        return res.redirect(`${FRONTEND_URL}/customer/login?token=${token}&user=${userData}`);
    })(req, res, next);
};
    
    /**
     * Get OAuth user info (for API response instead of redirect)
     * Alternative endpoint that returns JSON instead of redirect
     */
    googleCallbackJson = (req, res, next) => {
        passport.authenticate('google', { session: false }, (err, profile) => {
            if (err || !profile) {
                return res.status(401).json({
                    success: false,
                    message: 'Google authentication failed',
                    error: err?.message
                });
            }
            
            res.status(200).json({
                success: true,
                message: 'Google login successful',
                data: {
                    customer: {
                        customerId: profile.userData.customerId,
                        firstName: profile.userData.firstName,
                        lastName: profile.userData.lastName,
                        email: profile.userData.email,
                        profileImage: profile.userData.profileImage
                    },
                    token: profile.authToken
                }
            });
        })(req, res, next);
    };
}

module.exports = new OAuthController();