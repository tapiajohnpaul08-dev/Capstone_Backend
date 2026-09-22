const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, ref: 'Conversation', required: true, index: true },

  // Sender information
  senderType: { type: String, enum: ['customer', 'admin'], required: true },
  senderId: { type: String, required: true, index: true },
  senderName: { type: String, required: true },

  // Message content
  content: { type: String, required: true },
  contentType: {
    type: String,
    enum: ['text', 'image', 'file', 'system', 'quote', 'payment-request', 'payment-proof', 'delay-notice'],
    default: 'text',
  },

  // Quote payload (only set when contentType === 'quote')
  quoteData: {
    orderId: { type: String, index: true },
    customerName: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    designFee: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    deliveryMethod: { type: String, default: 'Pick-up' },
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'superseded'],
      default: 'pending',
    },
    respondedAt: { type: Date, default: null },
    respondedBy: { type: String, default: '' },
    notes: { type: String, default: '' },
  },

  // ── Payment request payload (only set when contentType === 'payment-request') ──
  paymentRequestData: {
    orderId: { type: String, index: true },
    method: { type: String, enum: ['gcash', 'bank_transfer'], required: false },
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    bankName: { type: String, default: '' }, // only for bank_transfer
    amountDue: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'proof-submitted', 'verified', 'rejected', 'superseded'],
      default: 'pending',
    },
    statusUpdatedAt: { type: Date, default: null },
    statusUpdatedBy: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
  },

    // ── Delay notice payload (only set when contentType === 'delay-notice') ──
  delayNoticeData: {
    orderId: { type: String, index: true, default: '' },
    category: { type: String, default: 'other' },
    reason: { type: String, default: '' },
    originalExpectedDelivery: { type: Date, default: null },
    newExpectedDelivery:      { type: Date, default: null },
    reportedAt: { type: Date, default: null },
  },

  // ── Payment proof payload (only set when contentType === 'payment-proof') ──
  paymentProofData: {
    paymentRequestMessageId: { type: String, index: true, default: '' },
    orderId: { type: String, index: true, default: '' },
    method: { type: String, default: '' },
    amountPaid: { type: Number, default: 0 },
    referenceNumber: { type: String, default: '' },
    proofImageUrl: { type: String, default: '' },
    note: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending-review', 'approved', 'rejected'],
      default: 'pending-review',
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
  },

  // File attachments
  attachments: [{
    name: { type: String },
    size: { type: Number },
    type: { type: String },
    path: { type: String },
    url: { type: String },
  }],

  // Reply to another message
  replyToMessageId: { type: String, ref: 'Message', default: null },
  replyTo: {
    type: {
      messageId: String,
      content: String,
      sender: String,
    },
    default: null,
  },

  // Read status
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedFor: [{ type: String }],

  createdAt: { type: Date, default: Date.now, index: true },
});

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isRead: 1 });
messageSchema.index({ senderId: 1, createdAt: -1 });


messageSchema.virtual('formattedTime').get(function () {
  return this.createdAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
});

messageSchema.virtual('formattedDate').get(function () {
  return this.createdAt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
});

module.exports = mongoose.model('Message', messageSchema);