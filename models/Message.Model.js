const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, ref: 'Conversation', required: true, index: true },
  
  // Sender information (references your existing Customer/Admin models)
  senderType: { type: String, enum: ['customer', 'admin'], required: true },
  senderId: { type: String, required: true, index: true },
  senderName: { type: String, required: true },
  


  // Message content
  content: { type: String, required: true },
  contentType: { 
    type: String, 
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  
  
  // File attachments (for images, PDFs, documents)
  attachments: [{
    name: { type: String },
    size: { type: Number },
    type: { type: String },
    path: { type: String },
    url: { type: String }
  }],
  
  // Reply to another message (optional)
  replyToMessageId: { type: String, ref: 'Message', default: null },
  // In Message.Model.js - add this field
replyTo: {
  type: {
    messageId: String,
    content: String,
    sender: String
  },
  default: null
},
  // Read status
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
  
  // Soft delete (hide for specific user)
  isDeleted: { type: Boolean, default: false },
  deletedFor: [{ type: String }], // Array of user IDs who deleted this message
  
  // Timestamp
  createdAt: { type: Date, default: Date.now, index: true }
});

// Indexes for faster queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isRead: 1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

// Virtual for formatted time (optional)
messageSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
});

// Virtual for formatted date (optional)
messageSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-PH', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
});

module.exports = mongoose.model('Message', messageSchema);