const express = require('express');
const router = express.Router();
const OAuthController = require('../controller/OAuthController');

// ======================================
// GOOGLE OAuth Routes
// ======================================
router.get('/google', OAuthController.googleAuth);
router.get('/google/callback', OAuthController.googleCallback);
router.get('/google/json', OAuthController.googleCallbackJson); // JSON response alternative

// ======================================
// FACEBOOK OAuth Routes
// ======================================
router.get('/facebook', OAuthController.facebookAuth);
router.get('/facebook/callback', OAuthController.facebookCallback);

module.exports = router;