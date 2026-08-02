// controller/OAuthController.js
const passport = require('../config/passport');

const FRONTEND_URL = process.env.NODE_ENV === 'production'
    ? 'https://capstone-acapsshop.vercel.app'  // ← Correct frontend URL
    : 'http://localhost:5173';

class OAuthController {
    
    googleAuth(req, res, next) {
        passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
    };
    
    googleCallback(req, res, next) {
        passport.authenticate('google', { session: false }, (err, profile) => {
            if (err || !profile) {
                console.error('Google auth error:', err);
                return res.redirect(`${FRONTEND_URL}/customer/login?error=auth_failed`);
            }
            
            const token = profile.authToken;
            const userData = profile.userData;
            
            const encodedUserData = encodeURIComponent(JSON.stringify({
                _id: userData._id,
                customerId: userData.customerId,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                profileImage: userData.profileImage,
                username: userData.username
            }));
            
            return res.redirect(`${FRONTEND_URL}/customer/login?token=${token}&user=${encodedUserData}`);
        })(req, res, next);
    };
    
    facebookAuth(req, res, next) {
        passport.authenticate('facebook', { scope: ['email', 'public_profile'] })(req, res, next);
    };
    
    facebookCallback(req, res, next) {
        passport.authenticate('facebook', { session: false }, (err, profile) => {
            if (err || !profile) {
                console.error('Facebook auth error:', err);
                return res.redirect(`${FRONTEND_URL}/customer/login?error=auth_failed`);
            }
            
            const token = profile.authToken;
            const userData = profile.userData;
            
            const encodedUserData = encodeURIComponent(JSON.stringify({
                _id: userData._id,
                customerId: userData.customerId,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                profileImage: userData.profileImage,
                username: userData.username
            }));
            
            return res.redirect(`${FRONTEND_URL}/customer/login?token=${token}&user=${encodedUserData}`);
        })(req, res, next);
    };
    
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