// routes/DesignRoutes.js
const express = require('express');
const router = express.Router();
const { designUpload } = require('../config/multer');
const { verifyCustomerToken, verifyAdminToken } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiters');


// ✅ Admin design upload — used when creating orders on behalf of a
// customer (walk-in) or uploading product artwork. Same Cloudinary
// storage as the customer route, but admin-authenticated.
router.post(
  '/admin/upload-design',
  uploadLimiter,
  verifyAdminToken,
  designUpload.array('files', 10),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
      }
      const files = req.files.map((file) => ({
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        path: file.path,        // Cloudinary URL
        url: file.path,
        public_id: file.public_id || file.filename,
        secure_url: file.secure_url || file.path,
      }));
      res.json({ success: true, files });
    } catch (error) {
      console.error('Admin design upload error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// Upload design files for order.
// uploadLimiter runs FIRST so unauthenticated floods are rejected before
// they hit the token verifier or multer's memory buffer.
router.post('/upload-design', uploadLimiter, verifyCustomerToken, designUpload.array('files', 10), (req, res) => {
  try {
    console.log('📤 Upload request received');
    console.log('Files:', req.files);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    const files = req.files.map(file => {
      // Cloudinary stores the URL in file.path
      const fileData = {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        path: file.path, // ← Cloudinary URL
        url: file.path,  // ← Cloudinary URL
        public_id: file.public_id || file.filename,
        // Also store the Cloudinary secure URL if available
        secure_url: file.secure_url || file.path
      };
      
      console.log('📄 File uploaded to Cloudinary:', fileData.path);
      return fileData;
    });
    
    res.json({ 
      success: true, 
      files,
      message: `${files.length} file(s) uploaded successfully to Cloudinary`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;