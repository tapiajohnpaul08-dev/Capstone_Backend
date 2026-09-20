// controller/ChatContoller.js
const chatService = require('../services/ChatServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class ChatController {

  getOrCreateConversation = asyncTryCatch(async (req, res, next) => {
    const { subject, orderId } = req.body;
    const { customerId, firstName, lastName, email } = req.customer;
    const customerName = `${firstName} ${lastName}`;
    const response = await chatService.getOrCreateConversation(
      customerId, customerName, email, subject, orderId
    );
    res.status(200).json(response);
  });

  getMyConversations = asyncTryCatch(async (req, res, next) => {
    const { customerId } = req.customer;
    const filters = { status: req.query.status, orderId: req.query.orderId };
    const response = await chatService.getCustomerConversations(customerId, filters);
    res.status(200).json(response);
  });

  getAdminConversations = asyncTryCatch(async (req, res, next) => {
    const filters = { status: req.query.status, adminId: req.query.admin_id };
    const response = await chatService.getAdminConversations(filters);
    res.status(200).json(response);
  });

  // ✅ NEW — Pending negotiations
  getPendingNegotiations = asyncTryCatch(async (req, res, next) => {
    const response = await chatService.getPendingNegotiations();
    res.status(200).json(response);
  });

  getConversation = asyncTryCatch(async (req, res, next) => {
    res.status(200).json({ success: true });
  });
  assignConversation = asyncTryCatch(async (req, res, next) => {
    const { conversationId } = req.params;
    const { adminId, firstName, lastName } = req.admin;
    const adminName = `${firstName} ${lastName}`;
    const response = await chatService.assignConversation(conversationId, adminId, adminName);
    res.status(200).json(response);
  });

  updateStatus = asyncTryCatch(async (req, res, next) => {
    const { conversationId } = req.params;
    const { status } = req.body;
    const response = await chatService.updateConversationStatus(conversationId, status);
    res.status(200).json(response);
  });

  sendMessage = asyncTryCatch(async (req, res, next) => {
    const { conversationId, content, attachments, replyToMessageId } = req.body;
    const userType = req.customer ? 'customer' : 'admin';
    const userId = req.customer?.customerId || req.admin?.adminId;
    const userName = req.customer?.firstName
      ? `${req.customer.firstName} ${req.customer.lastName}`
      : req.admin?.firstName
        ? `${req.admin.firstName} ${req.admin.lastName}`
        : 'User';

    const response = await chatService.sendMessage(
      conversationId, userId, userName, userType, content, attachments || [], replyToMessageId
    );

    const io = req.app.get('io');
    if (io && response.success) {
      io.to(`conv_${conversationId}`).emit('new-message', response.data);
    }

    res.status(201).json(response);
  });

  linkOrder = asyncTryCatch(async (req, res, next) => {
    const { conversationId } = req.params;
    const { orderId } = req.body;
    const { customerId } = req.customer;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const response = await chatService.linkOrderToConversation(conversationId, orderId, customerId);

    const io = req.app.get('io');
    if (io && response.success) {
      io.to(`conv_${conversationId}`).emit('conversation-order-linked', {
        conversationId,
        orderId,
      });
    }

    res.status(response.success ? 200 : 400).json(response);
  });

    unsendMessage = asyncTryCatch(async (req, res, next) => {
    const { messageId } = req.params;
    const userType = req.customer ? 'customer' : 'admin';
    const userId = req.customer?.customerId || req.admin?.adminId;
    const response = await chatService.unsendMessage(messageId, userId, userType);

    const io = req.app.get('io');
    if (io && response.success && response.data) {
      io.to(`conv_${response.data.conversationId}`).emit('message-unsent', {
        messageId: response.data.messageId,
        conversationId: response.data.conversationId,
      });
    }

    res.status(200).json(response);
  });

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

  getCustomerUnreadCount = asyncTryCatch(async (req, res, next) => {
    const { customerId } = req.customer;
    if (!customerId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await chatService.getUnreadCount(customerId, 'customer');
    res.status(200).json(result);
  });

  getAdminUnreadCount = asyncTryCatch(async (req, res, next) => {
    const adminId = req.admin?._id || req.admin?.adminId || req.user?._id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await chatService.getUnreadCount(adminId, 'admin');
    res.status(200).json(result);
  });

    // ─────────────────────────────────────────
  // GET /chat/admin/payment-options
  // ─────────────────────────────────────────
  getPaymentOptions = asyncTryCatch(async (req, res) => {
    const PaymentOptionsService = require('../services/PaymentOptionsService');
    const response = PaymentOptionsService.getPaymentOptions();
    res.status(200).json(response);
  });

  // ─────────────────────────────────────────
  // POST /chat/admin/payment-request
  // ─────────────────────────────────────────
  sendPaymentRequest = asyncTryCatch(async (req, res) => {
    const { conversationId, orderId, method, amountDue, notes } = req.body;
    const admin = req.admin;

    if (!conversationId || !orderId || !method || !amountDue) {
      return res.status(400).json({
        success: false,
        message: 'conversationId, orderId, method, and amountDue are required',
      });
    }

    const response = await chatService.sendPaymentRequest(conversationId, admin, {
      orderId,
      method,
      amountDue: Number(amountDue),
      notes: notes || '',
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io && response.success) {
      io.to(`conv_${conversationId}`).emit('new-message', response.data);
    }

    res.status(response.success ? 201 : 400).json(response);
  });

  // ─────────────────────────────────────────
  // POST /chat/customer/payment-proof
  // ─────────────────────────────────────────
  sendPaymentProof = asyncTryCatch(async (req, res) => {
    const {
      conversationId,
      paymentRequestMessageId,
      referenceNumber,
      proofImageUrl,
      note,
    } = req.body;
    const customer = req.customer;

    if (!conversationId || !paymentRequestMessageId || !proofImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'conversationId, paymentRequestMessageId, and proofImageUrl are required',
      });
    }

    const response = await chatService.sendPaymentProof(conversationId, customer, {
      paymentRequestMessageId,
      referenceNumber: referenceNumber || '',
      proofImageUrl,
      note: note || '',
    });

    const io = req.app.get('io');
    if (io && response.success) {
      io.to(`conv_${conversationId}`).emit('new-message', response.data);
      io.to(`conv_${conversationId}`).emit('payment-request-updated', response.requestMessage);
    }

    res.status(response.success ? 201 : 400).json(response);
  });

  // ─────────────────────────────────────────
  // POST /chat/admin/payment-proof/:messageId/reject
  // ─────────────────────────────────────────
  rejectPaymentProof = asyncTryCatch(async (req, res) => {
    const { messageId } = req.params;
    const { reason } = req.body;
    const admin = req.admin;

    const response = await chatService.rejectPaymentProof(messageId, admin, reason || '');

    const io = req.app.get('io');
    if (io && response.success) {
      const conversationId = response.data.conversationId;
      io.to(`conv_${conversationId}`).emit('payment-proof-updated', response.data);
      io.to(`conv_${conversationId}`).emit('payment-request-updated', response.requestMessage);
      io.to(`conv_${conversationId}`).emit('new-message', response.systemMessage);

      // ✅ NEW: fetch the updated order and emit so the NegotiationPanel
      // re-enables "Send Payment Details" after the rejection
      try {
        const orderId = response.data.paymentProofData.orderId;
        const Order = require('../models/Order.Model');
        const updatedOrder = await Order.findOne({ orderId }).lean();
        if (updatedOrder) {
          io.to(`conv_${conversationId}`).emit('order-negotiation-updated', updatedOrder);
          console.log(`📤 Emitted order-negotiation-updated after reject for ${orderId}`);
        }
      } catch (e) {
        console.error('Emit order after reject error:', e);
      }
    }

    res.status(response.success ? 200 : 400).json(response);
  });

    // ─────────────────────────────────────────
  // POST /chat/admin/payment-proof/:messageId/verify
  //
  // Approves the proof AND confirms the order atomically.
  // ─────────────────────────────────────────
  verifyPaymentProof = asyncTryCatch(async (req, res) => {
    const { messageId } = req.params;
    const { isFullPayment = false, adjustedAmount = null } = req.body;
    const admin = req.admin;

    const Message = require('../models/Message.Model');
    const OrderService = require('../services/OrderServices');

    const proofMsg = await Message.findOne({ messageId });
    if (!proofMsg || proofMsg.contentType !== 'payment-proof') {
      return res.status(404).json({ success: false, message: 'Payment proof not found' });
    }
    if (proofMsg.paymentProofData.status !== 'pending-review') {
      return res.status(400).json({ success: false, message: `Proof already ${proofMsg.paymentProofData.status}` });
    }

    const orderId = proofMsg.paymentProofData.orderId;
    const amountPaid = adjustedAmount != null ? Number(adjustedAmount) : proofMsg.paymentProofData.amountPaid;

    // Atomic confirm
    const result = await OrderService.confirmWithDownpayment(
      orderId,
      {
        amountPaid,
        method: proofMsg.paymentProofData.method,
        referenceNumber: proofMsg.paymentProofData.referenceNumber,
        proofUrl: proofMsg.paymentProofData.proofImageUrl,
        isFullPayment: !!isFullPayment,
        paymentRequestMessageId: proofMsg.paymentProofData.paymentRequestMessageId,
      },
      admin
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Approve the proof message
    proofMsg.paymentProofData.status = 'approved';
    proofMsg.paymentProofData.reviewedAt = new Date();
    proofMsg.paymentProofData.reviewedBy = admin?.firstName
      ? `${admin.firstName} ${admin.lastName}`
      : admin?.email || 'Admin';
    await proofMsg.save();

    const conversationId = proofMsg.conversationId;

    const io = req.app.get('io');
    if (io) {
      io.to(`conv_${conversationId}`).emit('payment-proof-updated', proofMsg);
      io.to(`conv_${conversationId}`).emit('order-negotiation-updated', result.data);
    }

    res.status(200).json({ success: true, data: result.data, proof: proofMsg });
  });
}

module.exports = new ChatController();