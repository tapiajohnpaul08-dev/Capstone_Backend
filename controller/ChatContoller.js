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
    // This would need a getConversationById method
    const { conversationId } = req.params;
    // Implementation...
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
    const { conversationId, content, attachments } = req.body;
    const userType = req.customer ? 'customer' : 'admin';
    const userId = req.customer?.customerId || req.admin?.adminId;
    const userName = req.customer?.firstName 
      ? `${req.customer.firstName} ${req.customer.lastName}`
      : req.admin?.firstName 
        ? `${req.admin.firstName} ${req.admin.lastName}`
        : 'User';
    
    const response = await chatService.sendMessage(
      conversationId, userId, userName, userType, content, attachments || []
    );
    
    res.status(201).json(response);
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
  
  // Get unread count
  getUnreadCount = asyncTryCatch(async (req, res, next) => {
    const userType = req.customer ? 'customer' : 'admin';
    const userId = req.customer?.customerId || req.admin?.adminId;
    
    const response = await chatService.getUnreadCount(userId, userType);
    res.status(200).json(response);
  });
}

module.exports = new ChatController();