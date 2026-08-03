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
      
      for (const conv of conversations) {
        const lastMessage = await Message.findOne({ 
          conversationId: conv.conversationId,
          isDeleted: { $ne: true } // Exclude deleted messages
        }).sort({ createdAt: -1 });
        
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
        const lastMessage = await Message.findOne({ 
          conversationId: conv.conversationId,
          isDeleted: { $ne: true } // Exclude deleted messages
        }).sort({ createdAt: -1 });
        
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
  
async sendMessage(conversationId, senderId, senderName, senderType, content, attachments = [], replyToMessageId = null) {
  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return { success: false, message: 'Conversation not found' };
    }
    
    const isCustomer = senderType === 'customer';
    
    console.log('📨 Service received replyToMessageId:', replyToMessageId);
    
    // If replying, get the original message
    let replyTo = null;
    if (replyToMessageId) {
      const originalMessage = await Message.findOne({ messageId: replyToMessageId });
      console.log('📨 Original message found:', originalMessage ? 'YES' : 'NO');
      if (originalMessage && !originalMessage.isDeleted) {
        replyTo = {
          messageId: originalMessage.messageId,
          content: originalMessage.content || '📎 Attachment',
          sender: originalMessage.senderName || originalMessage.senderType
        };
        console.log('📨 ReplyTo data set:', replyTo);
      }
    }
    
    // In sendMessage method, when creating the message object:
const message = new Message({
  messageId: await generateId('MSG'),
  conversationId,
  senderType,
  senderId,
  senderName,
  content,
  attachments: attachments.map(att => {
    // If attachment has a Cloudinary path, use it
    if (att.path && att.path.includes('cloudinary.com')) {
      return {
        ...att,
        url: att.path,
        publicId: att.public_id || getPublicId(att.path)
      };
    }
    return att;
  }),
  replyTo: replyTo,
  replyToMessageId: replyToMessageId,
  isDeleted: false
});
    await message.save();
    console.log('📨 Message saved with replyTo:', message.replyTo);
    console.log('📨 Message saved with replyToMessageId:', message.replyToMessageId);
    
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
    
    if (isCustomer && ['resolved', 'closed'].includes(conversation.status)) {
      conversation.status = 'open';
    }
    
    await conversation.save();
    
    // Return the full message with replyTo data
    const savedMessage = await Message.findOne({ messageId: message.messageId });
    
    return { success: true, data: savedMessage, conversation };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    throw error;
  }
}
  // ─────────────────────────────────────────
  // UNSEND MESSAGE
  // ─────────────────────────────────────────
  async unsendMessage(messageId, userId, userType) {
    try {
      const message = await Message.findOne({ messageId });
      if (!message) {
        return { success: false, message: 'Message not found' };
      }
      
      // Check if user is the sender
      if (message.senderId !== userId || message.senderType !== userType) {
        return { success: false, message: 'You can only unsend your own messages' };
      }
      
      // Check if message is already deleted
      if (message.isDeleted) {
        return { success: false, message: 'Message already unsent' };
      }
      
      // Check if message is too old (e.g., older than 5 minutes)
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const MAX_UNSEND_TIME = 5 * 60 * 1000; // 5 minutes
      
      if (messageAge > MAX_UNSEND_TIME) {
        return { success: false, message: 'Message can only be unsent within 5 minutes' };
      }
      
      // Soft delete the message
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.content = 'This message was unsent';
      await message.save();
      
      // Update conversation last message if this was the last message
      const conversation = await Conversation.findOne({ conversationId: message.conversationId });
      if (conversation) {
        // Find the most recent non-deleted message
        const lastMessage = await Message.findOne({
          conversationId: message.conversationId,
          isDeleted: { $ne: true }
        }).sort({ createdAt: -1 });
        
        if (lastMessage) {
          conversation.lastMessage = lastMessage.content;
          conversation.lastMessageAt = lastMessage.createdAt;
          conversation.lastMessageBy = lastMessage.senderType;
        } else {
          conversation.lastMessage = 'No messages';
          conversation.lastMessageAt = new Date();
          conversation.lastMessageBy = null;
        }
        await conversation.save();
      }
      
      return { 
        success: true, 
        message: 'Message unsent successfully',
        data: message
      };
    } catch (error) {
      console.error('Error in unsendMessage:', error);
      throw error;
    }
  }
  
  async getMessages(conversationId, userType, userId, limit = 50, before = null) {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        return { success: false, message: 'Conversation not found' };
      }
      
      if (userType === 'customer' && conversation.customerId !== userId) {
        return { success: false, message: 'Access denied' };
      }
      
      const query = { 
        conversationId,
        isDeleted: { $ne: true } // Exclude deleted messages
      };
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }
      
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);
      
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
      
      let query = {};
      if (userType === 'customer') {
        query = { customerId: userId };
      } else {
        query = { 
          $or: [
            { adminId: userId },
            { adminId: null }
          ]
        };
      }
      
      const conversations = await Conversation.find(query);
      const totalUnread = conversations.reduce((sum, c) => sum + (c[field] || 0), 0);
      
      return { success: true, data: { total: totalUnread } };
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      throw error;
    }
  }

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

  async getConversationWithParticipants(conversationId) {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }
      
      const socketService = require('../server').socketService;
      
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