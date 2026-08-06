// routes/DesignRoutes.js
const express = require('express');
const router = express.Router();
const { designUpload } = require('../config/multer');
const { verifyCustomerToken } = require('../middleware/authMiddleware');

// Upload design files for order
router.post('/upload-design', verifyCustomerToken, designUpload.array('files', 10), (req, res) => {
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