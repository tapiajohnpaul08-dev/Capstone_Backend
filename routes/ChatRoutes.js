const express = require('express');
const router = express.Router();
const ChatController = require('../controller/ChatContoller');
const { verifyCustomerToken, verifyAdminToken } = require('../middleware/authMiddleware');
const { chatUpload } = require('../config/multer');

// ─────────────────────────────────────────
// CUSTOMER ROUTES
// ─────────────────────────────────────────
router.post('/customer/conversations', verifyCustomerToken, ChatController.getOrCreateConversation);
router.get('/customer/conversations', verifyCustomerToken, ChatController.getMyConversations);
router.get('/customer/conversations/:conversationId/messages', verifyCustomerToken, ChatController.getMessages);
router.post('/customer/messages', verifyCustomerToken, ChatController.sendMessage);
router.get('/customer/unread-count', verifyCustomerToken, ChatController.getCustomerUnreadCount);
router.patch('/customer/conversations/:conversationId/status', verifyCustomerToken, ChatController.updateStatus);
router.delete('/customer/messages/:messageId', verifyCustomerToken, ChatController.unsendMessage);

// ─────────────────────────────────────────
// ADMIN ROUTES 
// ─────────────────────────────────────────
router.get('/admin/conversations', verifyAdminToken, ChatController.getAdminConversations);
router.get('/admin/conversations/:conversationId/messages', verifyAdminToken, ChatController.getMessages);
router.post('/admin/messages', verifyAdminToken, ChatController.sendMessage);
router.get('/admin/unread-count', verifyAdminToken, ChatController.getAdminUnreadCount);
router.patch('/admin/conversations/:conversationId/assign', verifyAdminToken, ChatController.assignConversation);
router.patch('/admin/conversations/:conversationId/status', verifyAdminToken, ChatController.updateStatus);
router.delete('/admin/messages/:messageId', verifyAdminToken, ChatController.unsendMessage);

// ✅ FIXED: File upload endpoint for customer - with better error handling
router.post('/customer/upload', verifyCustomerToken, (req, res, next) => {
  // Use chatUpload middleware with error handling
  chatUpload.array('files', 5)(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ 
        success: false, 
        message: err.message || 'File upload failed' 
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    
    const files = req.files.map(file => {
      // Cloudinary stores the URL in file.path
      const fileData = {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        path: file.path || file.url,
        url: file.url || file.path,
        public_id: file.public_id || file.filename
      };
      
      console.log('📤 Customer file uploaded to Cloudinary:', fileData.path);
      return fileData;
    });
    
    res.json({ success: true, files });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ FIXED: File upload endpoint for admin - with better error handling
router.post('/upload', verifyAdminToken, (req, res, next) => {
  chatUpload.array('files', 5)(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ 
        success: false, 
        message: err.message || 'File upload failed' 
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    
    const files = req.files.map(file => {
      const fileData = {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        path: file.path || file.url,
        url: file.url || file.path,
        public_id: file.public_id || file.filename
      };
      
      console.log('📤 Admin file uploaded to Cloudinary:', fileData.path);
      return fileData;
    });
    
    res.json({ success: true, files });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;