// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Log configuration status (without exposing secrets)
console.log('✅ Cloudinary configured for cloud:', process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET');

module.exports = cloudinary;