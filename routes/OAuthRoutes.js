// routes/OAuthRoutes.js
const express = require('express');
const router = express.Router();
const OAuthController = require('../controller/OAuthController');

// ======================================
// GOOGLE OAuth Routes - Customer Only
// ======================================
router.get('/google', OAuthController.googleAuth);
router.get('/google/callback', OAuthController.googleCallback);
router.get('/google/json', OAuthController.googleCallbackJson);

// ======================================
// FACEBOOK OAuth Routes - Customer Only
// ======================================
router.get('/facebook', OAuthController.facebookAuth);
router.get('/facebook/callback', OAuthController.facebookCallback);

module.exports = router;