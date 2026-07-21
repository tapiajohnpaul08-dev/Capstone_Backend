const chatService = require('../services/ChatServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class ChatController {
  
  // Customer: Get or create conversation
  getOrCreateConversation = asyncTryCatch(async (req, res, next) => {
    const { subject, orderId } = req.body;
    const { customerId, firstName, lastName, email } = req.customer;
    const customerName = `${firstName} ${lastName}`;
    
    const response = await chatService.getOrCreateConversation(
      customerId, customerName, email, subject, orderId
    );
    
    res.status(200).json(response);
  });
  
  // Customer: Get my conversations
  getMyConversations = asyncTryCatch(async (req, res, next) => {
    const { customerId } = req.customer;
    const filters = {
      status: req.query.status,
      orderId: req.query.orderId
    };
    
    const response = await chatService.getCustomerConversations(customerId, filters);
    res.status(200).json(response);
  });
  
  // Admin: Get all conversations
  getAdminConversations = asyncTryCatch(async (req, res, next) => {
    const filters = {
      status: req.query.status,
      adminId: req.query.admin_id
    };
    
    const response = await chatService.getAdminConversations(filters);
    res.status(200).json(response);
  });
  
  // Get single conversation
  getConversation = asyncTryCatch(async (req, res, next) => {
    const { conversationId } = req.params;
    res.status(200).json({ success: true });
  });
  
  // Admin: Assign conversation
  assignConversation = asyncTryCatch(async (req, res, next) => {
    const { conversationId } = req.params;
    const { adminId, firstName, lastName } = req.admin;
    const adminName = `${firstName} ${lastName}`;
    
    const response = await chatService.assignConversation(conversationId, adminId, adminName);
    res.status(200).json(response);
  });
  
  // Update status
  updateStatus = asyncTryCatch(async (req, res, next) => {
    const { conversationId } = req.params;
    const { status } = req.body;
    
    const response = await chatService.updateConversationStatus(conversationId, status);
    res.status(200).json(response);
  });
  
  // Send message
  sendMessage = asyncTryCatch(async (req, res, next) => {
    const { conversationId, content, attachments, replyToMessageId } = req.body;
    const userType = req.customer ? 'customer' : 'admin';
    const userId = req.customer?.customerId || req.admin?.adminId;
    const userName = req.customer?.firstName 
      ? `${req.customer.firstName} ${req.customer.lastName}`
      : req.admin?.firstName 
        ? `${req.admin.firstName} ${req.admin.lastName}`
        : 'User';
    
    console.log('📨 Controller received:', { 
      conversationId, 
      userId, 
      userType, 
      content, 
      replyToMessageId 
    });
    
    const response = await chatService.sendMessage(
      conversationId, userId, userName, userType, content, attachments || [], replyToMessageId
    );
    
    console.log('📨 Controller response:', response.success ? 'SUCCESS' : 'FAILED');
    console.log('📨 Controller replyTo:', response.data?.replyTo);
    
    const io = req.app.get('io');
    if (io && response.success) {
      io.to(conversationId).emit('new-message', response.data);
    }
    
    res.status(201).json(response);
  });
  
  // ─────────────────────────────────────────
  // UNSEND MESSAGE
  // ─────────────────────────────────────────
  unsendMessage = asyncTryCatch(async (req, res, next) => {
    const { messageId } = req.params;
    const userType = req.customer ? 'customer' : 'admin';
    const userId = req.customer?.customerId || req.admin?.adminId;
    
    const response = await chatService.unsendMessage(messageId, userId, userType);
    res.status(200).json(response);
  });
  
  // Get messages
  getMessages = asyncTryCatch(async (req, res, next) => {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;
    const userType = req.customer ? 'customer' : 'admin';
    const userId = req.customer?.customerId || req.admin?.adminId;
    
    const response = await chatService.getMessages(
      conversationId, userType, userId, parseInt(limit), before
    );
    
    res.status(200).json(response);
  });
  
  // ─────────────────────────────────────────
  // GET UNREAD COUNT - CUSTOMER
  // ─────────────────────────────────────────
  getCustomerUnreadCount = asyncTryCatch(async (req, res, next) => {
    const { customerId } = req.customer;
    
    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    const result = await chatService.getUnreadCount(customerId, 'customer');
    res.status(200).json(result);
  });
  
  // ─────────────────────────────────────────
  // GET UNREAD COUNT - ADMIN
  // ─────────────────────────────────────────
  getAdminUnreadCount = asyncTryCatch(async (req, res, next) => {
    const adminId = req.admin?._id || req.admin?.adminId || req.user?._id;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    const result = await chatService.getUnreadCount(adminId, 'admin');
    res.status(200).json(result);
  });
}

module.exports = new ChatController();