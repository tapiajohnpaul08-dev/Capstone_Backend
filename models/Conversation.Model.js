const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  
  // Participants
  customerId: { type: String, ref: 'Customer', required: true, index: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true, index: true },
  
  adminId: { type: String, ref: 'Admin', default: null },
  adminName: { type: String, default: '' },
  
  // Conversation metadata
  subject: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
    index: true
  },
  
  // Unread counts
  customerUnreadCount: { type: Number, default: 0 },
  adminUnreadCount: { type: Number, default: 0 },
  
  // Last message tracking
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastMessageBy: { type: String, enum: ['customer', 'admin'], default: null },
  
  // Optional link to order
  orderId: { type: String, ref: 'Order', index: true },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

conversationSchema.index({ customerId: 1, status: 1 });
conversationSchema.index({ adminId: 1, status: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);