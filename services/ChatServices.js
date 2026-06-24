const Conversation = require('../models/Conversation.Model');
const Message = require('../models/Message.Model');
const generateId = require('../utils/generateId');

class ChatService {
  
  // ─────────────────────────────────────────
  // CONVERSATIONS
  // ─────────────────────────────────────────
  
  async getOrCreateConversation(customerId, customerName, customerEmail, subject = '', orderId = null) {
    try {
      let conversation = await Conversation.findOne({
        customerId,
        status: { $in: ['open', 'in_progress'] },
        ...(orderId && { orderId })
      }).sort({ lastMessageAt: -1 });
      
      if (!conversation) {
        conversation = new Conversation({
          conversationId: await generateId('CONV'),
          customerId,
          customerName,
          customerEmail,
          subject: subject || 'General Inquiry',
          orderId: orderId || null,
          status: 'open',
          lastMessageAt: new Date()
        });
        await conversation.save();
      }
      
      return { success: true, data: conversation };
    } catch (error) {
      console.error('Error in getOrCreateConversation:', error);
      throw error;
    }
  }
  
  async getCustomerConversations(customerId, filters = {}) {
    try {
      const query = { customerId };
      if (filters.status) query.status = filters.status;
      if (filters.orderId) query.orderId = filters.orderId;
      
      const conversations = await Conversation.find(query)
        .sort({ lastMessageAt: -1 });
      
      // Get last message for each conversation
      for (const conv of conversations) {
        const lastMessage = await Message.findOne({ conversationId: conv.conversationId })
          .sort({ createdAt: -1 });
        
        conv._doc.lastMessage = lastMessage?.content || '';
        conv._doc.lastMessageTime = lastMessage?.createdAt || conv.lastMessageAt;
        conv._doc.unreadCount = conv.customerUnreadCount;
      }
      
      return { success: true, data: conversations };
    } catch (error) {
      console.error('Error in getCustomerConversations:', error);
      throw error;
    }
  }
  
  async getAdminConversations(filters = {}) {
    try {
      const query = {};
      if (filters.status) query.status = filters.status;
      if (filters.adminId) query.adminId = filters.adminId;
      
      const conversations = await Conversation.find(query)
        .sort({ lastMessageAt: -1 });
      
      for (const conv of conversations) {
        const lastMessage = await Message.findOne({ conversationId: conv.conversationId })
          .sort({ createdAt: -1 });
        
        conv._doc.lastMessage = lastMessage?.content || '';
        conv._doc.lastMessageTime = lastMessage?.createdAt || conv.lastMessageAt;
        conv._doc.unreadCount = conv.adminUnreadCount;
      }
      
      return { success: true, data: conversations };
    } catch (error) {
      console.error('Error in getAdminConversations:', error);
      throw error;
    }
  }
  
  async assignConversation(conversationId, adminId, adminName) {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        return { success: false, message: 'Conversation not found' };
      }
      
      conversation.adminId = adminId;
      conversation.adminName = adminName;
      conversation.status = 'in_progress';
      await conversation.save();
      
      return { success: true, data: conversation };
    } catch (error) {
      console.error('Error in assignConversation:', error);
      throw error;
    }
  }
  
  async updateConversationStatus(conversationId, status) {
    try {

      console.log('sent status:', status)
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        return { success: false, message: 'Conversation not found' };
      }
      
      conversation.status = status;
      await conversation.save();
      
      return { success: true, data: conversation };
    } catch (error) {
      console.error('Error in updateConversationStatus:', error);
      throw error;
    }
  }
  
  // ─────────────────────────────────────────
  // MESSAGES
  // ─────────────────────────────────────────
  
  async sendMessage(conversationId, senderId, senderName, senderType, content, attachments = []) {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        return { success: false, message: 'Conversation not found' };
      }
      
      const isCustomer = senderType === 'customer';
      
      const message = new Message({
        messageId: await generateId('MSG'),
        conversationId,
        senderType,
        senderId,
        senderName,
        content,
        attachments
      });
      
      await message.save();
      
      // Update conversation
      conversation.lastMessage = content;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageBy = senderType;
      
      if (isCustomer) {
        conversation.adminUnreadCount += 1;
        conversation.customerUnreadCount = 0;
      } else {
        conversation.customerUnreadCount += 1;
        conversation.adminUnreadCount = 0;
      }
      
      // Reopen if customer messages on resolved/closed conversation
      if (isCustomer && ['resolved', 'closed'].includes(conversation.status)) {
        conversation.status = 'open';
      }
      
      await conversation.save();
      
      return { success: true, data: message, conversation };
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  }
  
  async getMessages(conversationId, userType, userId, limit = 50, before = null) {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        return { success: false, message: 'Conversation not found' };
      }
      
      // Verify access
      if (userType === 'customer' && conversation.customerId !== userId) {
        return { success: false, message: 'Access denied' };
      }
      
      const query = { conversationId };
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }
      
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);
      
      // Mark as read
      const isCustomer = userType === 'customer';
      const updateField = isCustomer ? 'customerUnreadCount' : 'adminUnreadCount';
      
      await Conversation.updateOne(
        { conversationId },
        { $set: { [updateField]: 0 } }
      );
      
      await Message.updateMany(
        { conversationId, senderType: { $ne: userType }, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );
      
      return { success: true, data: messages.reverse() };
    } catch (error) {
      console.error('Error in getMessages:', error);
      throw error;
    }
  }
  
  async getUnreadCount(userId, userType) {
    try {
      const field = userType === 'customer' ? 'customerUnreadCount' : 'adminUnreadCount';
      const query = userType === 'customer' ? { customerId: userId } : { adminId: userId };
      
      const conversations = await Conversation.find(query);
      const totalUnread = conversations.reduce((sum, c) => sum + (c[field] || 0), 0);
      
      return { success: true, data: { total: totalUnread } };
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      throw error;
    }
  }

  // Get unread conversations for a user
async getUnreadConversations(userId, userType) {
  try {
    const query = userType === 'customer' 
      ? { customerId: userId, customerUnreadCount: { $gt: 0 } }
      : { adminId: userId, adminUnreadCount: { $gt: 0 } };
    
    const conversations = await Conversation.find(query)
      .select('conversationId subject lastMessage lastMessageAt customerUnreadCount adminUnreadCount');
    
    const totalUnread = conversations.reduce((sum, c) => {
      return sum + (userType === 'customer' ? c.customerUnreadCount : c.adminUnreadCount);
    }, 0);
    
    return { success: true, data: { conversations, totalUnread } };
  } catch (error) {
    console.error('Error getting unread conversations:', error);
    throw error;
  }
}

// Get conversation by ID with participants
async getConversationWithParticipants(conversationId) {
  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }
    
    // Get online status from socket service
    const socketService = require('../server').socketService; // You'll need to export this
    
    return {
      success: true,
      data: {
        ...conversation.toObject(),
        customerOnline: socketService?.isUserOnline(conversation.customerId) || false,
        adminOnline: conversation.adminId ? socketService?.isUserOnline(conversation.adminId) || false : false
      }
    };
  } catch (error) {
    console.error('Error getting conversation:', error);
    throw error;
  }
}
}

module.exports = new ChatService();