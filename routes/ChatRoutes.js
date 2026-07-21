const express = require('express');
const router = express.Router();
const ChatController = require('../controller/ChatContoller');
const { verifyCustomerToken, verifyAdminToken } = require('../middleware/authMiddleware');
const { chatUpload } = require('../middleware/upload');

// ─────────────────────────────────────────
// CUSTOMER ROUTES
// ─────────────────────────────────────────
router.post('/customer/conversations', verifyCustomerToken, ChatController.getOrCreateConversation);
router.get('/customer/conversations', verifyCustomerToken, ChatController.getMyConversations);
router.get('/customer/conversations/:conversationId/messages', verifyCustomerToken, ChatController.getMessages);
router.post('/customer/messages', verifyCustomerToken, ChatController.sendMessage);
router.get('/customer/unread-count', verifyCustomerToken, ChatController.getUnreadCount);
router.patch('/customer/conversations/:conversationId/status', verifyCustomerToken, ChatController.updateStatus);
// Unsend message for customer
router.delete('/customer/messages/:messageId', verifyCustomerToken, ChatController.unsendMessage);

// ─────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────
router.get('/admin/conversations', verifyAdminToken, ChatController.getAdminConversations);
router.get('/admin/conversations/:conversationId/messages', verifyAdminToken, ChatController.getMessages);
router.post('/admin/messages', verifyAdminToken, ChatController.sendMessage);
router.get('/admin/unread-count', verifyAdminToken, ChatController.getUnreadCount);
router.patch('/admin/conversations/:conversationId/assign', verifyAdminToken, ChatController.assignConversation);
router.patch('/admin/conversations/:conversationId/status', verifyAdminToken, ChatController.updateStatus);
// Unsend message for admin
router.delete('/admin/messages/:messageId', verifyAdminToken, ChatController.unsendMessage);

// File upload endpoint for chat
router.post('/upload', verifyAdminToken, chatUpload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    
    const files = req.files.map(file => {
      let relativePath = file.path.replace(/\\/g, '/')
      const uploadsIndex = relativePath.indexOf('uploads/')
      if (uploadsIndex !== -1) {
        relativePath = relativePath.substring(uploadsIndex)
      }
      
      return {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        path: relativePath
      }
    });
    
    res.json({ success: true, files });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/customer/upload', verifyCustomerToken, chatUpload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    
    const files = req.files.map(file => {
      let relativePath = file.path.replace(/\\/g, '/')
      const uploadsIndex = relativePath.indexOf('uploads/')
      if (uploadsIndex !== -1) {
        relativePath = relativePath.substring(uploadsIndex)
      }
      
      return {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        path: relativePath
      }
    });
    
    res.json({ success: true, files });
  } catch (error) {
    console.error('Customer upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;