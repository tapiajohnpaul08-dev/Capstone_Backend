// controller/OAuthController.js
const passport = require('../config/passport');

class OAuthController {
    
    /**
     * Initiate Google OAuth for Customer
     * GET /api/v1/auth/google
     */
    googleAuth(req, res, next) {
        passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
    };
    
    /**
     * Google OAuth Callback - Redirects to Customer Frontend
     * GET /api/v1/auth/google/callback
     */
    googleCallback(req, res, next) {
        passport.authenticate('google', { session: false }, (err, profile) => {
            if (err || !profile) {
                console.error('Google auth error:', err);
                return res.redirect('https://capstone-acapsshop.vercel.app/customer/login?error=auth_failed');
            }
            
            const token = profile.authToken;
            
            // Redirect to customer dashboard with token
            return res.redirect(`https://capstone-acapsshop.vercel.app/customer/dashboard?token=${token}`);
        })(req, res, next);
    };
    
    /**
     * Initiate Facebook OAuth for Customer
     * GET /api/v1/auth/facebook
     */
    facebookAuth(req, res, next) {
        passport.authenticate('facebook', { scope: ['email', 'public_profile'] })(req, res, next);
    };
    
    /**
     * Facebook OAuth Callback - Redirects to Customer Frontend
     * GET /api/v1/auth/facebook/callback
     */
    facebookCallback(req, res, next) {
        passport.authenticate('facebook', { session: false }, (err, profile) => {
            if (err || !profile) {
                console.error('Facebook auth error:', err);
                return res.redirect('https://capstone-acapsshop.vercel.app/customer/login?error=auth_failed');
            }
            
            const token = profile.authToken;
            return res.redirect(`https://capstone-acapsshop.vercel.app/customer/dashboard?token=${token}`);
        })(req, res, next);
    };
    
    /**
     * Google OAuth Callback with JSON response (for mobile apps)
     */
    googleCallbackJson(req, res, next) {
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