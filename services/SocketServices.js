// services/SocketServices.js
const Conversation = require('../models/Conversation.Model');
const Message = require('../models/Message.Model');
const generateId = require('../utils/generateId');

class SocketService {
  constructor(io) {
    this.io = io;
    this.onlineUsers = new Map();
    this.typingUsers = new Map();
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers.values());
  }

  addOnlineUser(userId, socketId, userType, userInfo) {
    this.onlineUsers.set(userId, {
      socketId,
      userType,
      userInfo,
      connectedAt: new Date()
    });
  }

  removeOnlineUser(userId) {
    this.onlineUsers.delete(userId);
  }

  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  joinConversation(socket, conversationId, userId, userType) {
    const roomName = `conv_${conversationId}`;
    socket.join(roomName);
    console.log(`User ${userId} (${userType}) joined room: ${roomName}`);
    
    socket.to(roomName).emit('user-joined', {
      userId,
      userType,
      timestamp: new Date()
    });
    
    return roomName;
  }

  leaveConversation(socket, conversationId) {
    const roomName = `conv_${conversationId}`;
    socket.leave(roomName);
  }

  handleTyping(conversationId, userId, userType, isTyping, socket) {
    const roomName = `conv_${conversationId}`;
    const typingKey = `${conversationId}_${userId}`;
    
    if (isTyping) {
      if (this.typingUsers.has(typingKey)) {
        clearTimeout(this.typingUsers.get(typingKey));
      }
      
      const timeout = setTimeout(() => {
        socket.to(roomName).emit('user-typing', {
          userId,
          userType,
          isTyping: false
        });
        this.typingUsers.delete(typingKey);
      }, 3000);
      
      this.typingUsers.set(typingKey, timeout);
    }
    
    socket.to(roomName).emit('user-typing', {
      userId,
      userType,
      isTyping
    });
  }

  async saveAndEmitMessage(conversationId, senderId, senderName, senderType, content, attachments, socket) {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return null;
      }
      
      const isCustomer = senderType === 'customer';
      
      const message = new Message({
        messageId: await generateId('MSG'),
        conversationId,
        senderType,
        senderId,
        senderName,
        content,
        contentType: attachments?.length > 0 ? (attachments[0].type?.startsWith('image/') ? 'image' : 'file') : 'text',
        attachments: attachments || [],
        createdAt: new Date()
      });
      
      await message.save();
      
      conversation.lastMessage = content;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageBy = senderType;
      
      if (isCustomer) {
        conversation.adminUnreadCount += 1;
        conversation.customerUnreadCount = 0;
        if (['resolved', 'closed'].includes(conversation.status)) {
          conversation.status = 'open';
        }
      } else {
        conversation.customerUnreadCount += 1;
        conversation.adminUnreadCount = 0;
      }
      
      await conversation.save();
      
      const messageData = message.toObject();
      this.io.to(`conv_${conversationId}`).emit('new-message', messageData);
      
      return messageData;
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', { message: 'Failed to save message' });
      return null;
    }
  }

  async markAsRead(conversationId, userId, userType, socket) {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) return;
      
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
      
      const otherType = isCustomer ? 'admin' : 'customer';
      this.io.to(`conv_${conversationId}`).emit('messages-read', {
        conversationId,
        readBy: userType,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }
}

module.exports = SocketService;