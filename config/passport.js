const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const Customer = require('../models/Customer.Model');
const generateId = require('../utils/generateId');
const jwt = require('jsonwebtoken');
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

/**
 * Generate JWT token for OAuth user
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            customerId: user.customerId,
            email: user.email,
            userName: user.username,
            provider: user.provider || 'social'
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

/**
 * Find or create user from OAuth profile
 */
const findOrCreateUser = async (profile, provider) => {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    const providerId = profile.id;

    console.log('Provider Email:', email);
    console.log('Provider ID:', providerId);
    console.log('Provider Name:', profile.displayName);

    // Check if user already exists by provider ID
    let user = await Customer.findOne({ 
        providerId: providerId,
        provider: provider 
    });
    
    if (user) {
        // User exists with this provider
        console.log('Existing user found by providerId:', user.email);
        return user;
    }
    
    // Check if user exists by email
    if (email) {
        user = await Customer.findOne({ email: email.toLowerCase() });
        if (user) {
            console.log('Existing user found by email:', user.email);
            // Link existing user to new provider
            user.providerId = providerId;
            user.provider = provider;
            user.profileImage = profile.photos && profile.photos[0] ? profile.photos[0].value : user.profileImage;
            await user.save();
            return user;
        }
    }
    
    // Create new user
    console.log('Creating new user for:', provider);
    
    // Safely extract name
    let firstName = provider;
    let lastName = '';
    
    if (profile.name) {
        firstName = profile.name.givenName || provider;
        lastName = profile.name.familyName || '';
    } else if (profile.displayName) {
        const nameParts = profile.displayName.split(' ');
        firstName = nameParts[0] || provider;
        lastName = nameParts.slice(1).join(' ') || '';
    }
    
    const newUser = new Customer({
        customerId: await generateId(),
        firstName: firstName,
        lastName: lastName,
        username: `${firstName}_${providerId.substring(0, 8)}`,
        email: email ? email.toLowerCase() : `${providerId}@${provider}.temp.com`,
        provider: provider,
        providerId: providerId,
        profileImage: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        isEmailVerified: !!email, // Mark as verified if email provided
        // No password for OAuth users
    });
    
    await newUser.save();
    console.log('New user created:', newUser.email);
    return newUser;
};

// ======================================
// Google Strategy
// ======================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'placeholder_for_development') {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/v1/auth/google/callback',
        scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('Google profile received');
            const user = await findOrCreateUser(profile, 'google');
            const token = generateToken(user);
            
            // Attach token and user to profile for response
            profile.authToken = token;
            profile.userData = user;
            
            return done(null, profile);
        } catch (error) {
            console.error('Google OAuth Error:', error);
            return done(error, null);
        }
    }));
}

// ======================================
// Facebook Strategy
// ======================================
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_ID !== 'placeholder_for_development') {
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackURL: '/api/v1/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'name', 'emails', 'photos'],
        enableProof: true
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('Facebook profile received');
            console.log('Facebook profile ID:', profile.id);
            console.log('Facebook displayName:', profile.displayName);
            
            const user = await findOrCreateUser(profile, 'facebook');
            const token = generateToken(user);
            
            // Attach token and user to profile for response
            profile.authToken = token;
            profile.userData = user;
            
            return done(null, profile);
        } catch (error) {
            console.error('Facebook OAuth Error:', error);
            return done(error, null);
        }
    }));
}

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id || user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await Customer.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;