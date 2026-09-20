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

router.patch('/customer/conversations/:conversationId/link-order', verifyCustomerToken, ChatController.linkOrder);
router.post('/customer/payment-proof', verifyCustomerToken, ChatController.sendPaymentProof);
// ─────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────
router.get('/admin/conversations', verifyAdminToken, ChatController.getAdminConversations);
// ✅ NEW — Pending negotiations (must come BEFORE /admin/conversations/:id)
router.get('/admin/pending-negotiations', verifyAdminToken, ChatController.getPendingNegotiations);router.get('/admin/conversations/:conversationId/messages', verifyAdminToken, ChatController.getMessages);
router.post('/admin/messages', verifyAdminToken, ChatController.sendMessage);
router.get('/admin/unread-count', verifyAdminToken, ChatController.getAdminUnreadCount);
router.patch('/admin/conversations/:conversationId/assign', verifyAdminToken, ChatController.assignConversation);
router.patch('/admin/conversations/:conversationId/status', verifyAdminToken, ChatController.updateStatus);
router.delete('/admin/messages/:messageId', verifyAdminToken, ChatController.unsendMessage);
router.get('/admin/payment-options', verifyAdminToken, ChatController.getPaymentOptions);
router.post('/admin/payment-request', verifyAdminToken, ChatController.sendPaymentRequest);
router.post('/admin/payment-proof/:messageId/reject', verifyAdminToken, ChatController.rejectPaymentProof);
router.post('/admin/payment-proof/:messageId/verify', verifyAdminToken, ChatController.verifyPaymentProof);

// ─────────────────────────────────────────
// FILE UPLOAD (customer)
// ─────────────────────────────────────────
router.post('/customer/upload', verifyCustomerToken, (req, res, next) => {
  chatUpload.array('files', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || 'File upload failed' });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    const files = req.files.map(file => ({
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: file.path || file.url,
      url: file.url || file.path,
      public_id: file.public_id || file.filename
    }));
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────
// FILE UPLOAD (admin)
// ─────────────────────────────────────────
router.post('/upload', verifyAdminToken, (req, res, next) => {
  chatUpload.array('files', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || 'File upload failed' });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    const files = req.files.map(file => ({
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: file.path || file.url,
      url: file.url || file.path,
      public_id: file.public_id || file.filename
    }));
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;