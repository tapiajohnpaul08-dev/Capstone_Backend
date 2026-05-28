const express = require('express');
const router = express.Router();
const { designUpload } = require('../middleware/upload');
const { verifyCustomerToken } = require('../middleware/authMiddleware');

// Upload design files for order
router.post('/upload-design', verifyCustomerToken, designUpload.array('files', 10), (req, res) => {
  try {
    const files = req.files.map(file => ({
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: `/uploads/designs/${file.filename}`
    }));
    
    res.json({ 
      success: true, 
      files,
      message: `${files.length} file(s) uploaded successfully`
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