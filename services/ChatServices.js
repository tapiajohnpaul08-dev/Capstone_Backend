const Conversation = require('../models/Conversation.Model');
const Message = require('../models/Message.Model');
const Order = require('../models/Order.Model');
const PaymentOptionsService = require('./PaymentOptionsService');

const generateId = require('../utils/generateId');
const { getPublicId } = require('../config/multer');


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


  
  
// In sendMessage method of ChatServices.js
async sendMessage(conversationId, senderId, senderName, senderType, content, attachments = [], replyToMessageId = null) {
  try {
    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return { success: false, message: 'Conversation not found' };
    }
    
    const isCustomer = senderType === 'customer';
    
    // Handle attachments - ensure they have proper Cloudinary URLs
    const processedAttachments = attachments.map(att => {
      // If attachment has a Cloudinary path, use it
      if (att.path && att.path.includes('cloudinary.com')) {
        return {
          ...att,
          url: att.path,
          publicId: att.public_id || getPublicId(att.path)
        };
      }
      // If attachment has a URL
      if (att.url && att.url.includes('cloudinary.com')) {
        return {
          ...att,
          path: att.url,
          url: att.url,
          publicId: att.public_id || getPublicId(att.url)
        };
      }
      return att;
    });
    
    // If replying, get the original message
    let replyTo = null;
    if (replyToMessageId) {
      const originalMessage = await Message.findOne({ messageId: replyToMessageId });
      if (originalMessage && !originalMessage.isDeleted) {
        replyTo = {
          messageId: originalMessage.messageId,
          content: originalMessage.content || '📎 Attachment',
          sender: originalMessage.senderName || originalMessage.senderType
        };
      }
    }
    
    const message = new Message({
      messageId: await generateId('MSG'),
      conversationId,
      senderType,
      senderId,
      senderName,
      content,
      attachments: processedAttachments,
      replyTo: replyTo,
      replyToMessageId: replyToMessageId,
      isDeleted: false
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
    
    if (isCustomer && ['resolved', 'closed'].includes(conversation.status)) {
      conversation.status = 'open';
    }
    
    await conversation.save();
    
    const savedMessage = await Message.findOne({ messageId: message.messageId });
    
    return { success: true, data: savedMessage, conversation };
  } catch (error) {
    console.error('Error in sendMessage:', error);
    throw error;
  }
}


  // ─────────────────────────────────────────
  // SEND QUOTE (admin → customer)
  //
  // Called by the admin when they want to send a negotiated price quote
  // to the customer. Creates a message with contentType 'quote' and
  // quoteData payload. Also updates the linked order's negotiationStatus.
  // ─────────────────────────────────────────
  async sendQuote(conversationId, adminId, adminName, quotePayload) {
    try {
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        return { success: false, message: 'Conversation not found' };
      }

      const order = await Order.findOne({ orderId: quotePayload.orderId });
      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      // Optional guard: only allow quotes on Pending + Unpaid orders
      if (order.status !== 'Pending' || order.paymentStatus !== 'Unpaid') {
        return {
          success: false,
          message: `Cannot quote an order with status "${order.status}" and payment "${order.paymentStatus}"`,
        };
      }

      // ── Mark any previously-pending quote in this conversation as superseded
      await Message.updateMany(
        {
          conversationId,
          contentType: 'quote',
          'quoteData.orderId': quotePayload.orderId,
          'quoteData.status': 'pending',
        },
        { $set: { 'quoteData.status': 'superseded' } }
      );

      // ── Snapshot the current order state into the quote
      const quoteData = {
        orderId: order.orderId,
        customerName: order.customerName || 'Customer',
        quantity: order.quantity,
        unitPrice: this._computeUnitPrice(order),
        designFee: order.designFee || 0,
        shippingFee: order.shippingFee || 0,
        deliveryMethod: order.receivingMode || 'Pick-up',
        totalAmount: order.amount || order.totalAmount || 0,
        status: 'pending',
        respondedAt: null,
        respondedBy: '',
        notes: quotePayload.notes || '',
      };

      const message = new Message({
        messageId: await generateId('MSG'),
        conversationId,
        senderType: 'admin',
        senderId: adminId,
        senderName: adminName,
        content: quotePayload.notes || `Quote for order ${order.orderId}`,
        contentType: 'quote',
        quoteData,
        isDeleted: false,
        createdAt: new Date(),
      });

      await message.save();

      // ── Update conversation preview
      conversation.lastMessage = `📋 Quote: ₱${quoteData.totalAmount.toLocaleString()}`;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageBy = 'admin';
      conversation.customerUnreadCount += 1;
      conversation.adminUnreadCount = 0;
      await conversation.save();

      // ── Mark order as "in negotiation"
      if (order.negotiationStatus !== 'in_progress') {
        order.negotiationStatus = 'in_progress';
        await order.save();
      }

      return {
        success: true,
        message: 'Quote sent successfully',
        data: message,
        order: order,
      };
    } catch (error) {
      console.error('Error in sendQuote:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // RESPOND TO QUOTE (customer → admin)
  //
  // Customer accepts or rejects the quote. On accept, the order moves to
  // Confirmed + Partial (downpayment still owed) and the accepted quote
  // is snapshotted onto the order.
  // ─────────────────────────────────────────
  async respondToQuote(messageId, customerId, customerName, response, reason = '') {
    try {
      const validResponses = ['accepted', 'rejected'];
      if (!validResponses.includes(response)) {
        return { success: false, message: 'Invalid response' };
      }

      const message = await Message.findOne({ messageId });
      if (!message) {
        return { success: false, message: 'Quote not found' };
      }

      if (message.contentType !== 'quote') {
        return { success: false, message: 'Message is not a quote' };
      }

      if (message.quoteData?.status !== 'pending') {
        return {
          success: false,
          message: `Quote already ${message.quoteData?.status || 'responded'}`,
        };
      }

      const order = await Order.findOne({ orderId: message.quoteData.orderId });
      if (!order) {
        return { success: false, message: 'Linked order not found' };
      }

      // ── Update quote status on the message
      message.quoteData.status = response;
      message.quoteData.respondedAt = new Date();
      message.quoteData.respondedBy = customerName;
      if (reason) message.quoteData.notes = reason;
      await message.save();

      // ── System message into the chat
      const systemMessage = new Message({
        messageId: await generateId('MSG'),
        conversationId: message.conversationId,
        senderType: 'customer',
        senderId: customerId,
        senderName: customerName,
        content:
          response === 'accepted'
            ? `✅ Accepted the quote for ${order.orderId}`
            : `❌ Rejected the quote for ${order.orderId}${reason ? `: ${reason}` : ''}`,
        contentType: 'system',
        isDeleted: false,
        createdAt: new Date(),
      });
      await systemMessage.save();

      // ── On accept → Confirm order
      if (response === 'accepted') {
        order.status = 'Confirmed';
        order.negotiationStatus = 'finalized';
        order.paymentStatus = 'Partial'; // downpayment still owed, but order is locked
        order.acceptedQuote = {
          messageId: message.messageId,
          acceptedAt: new Date(),
          acceptedBy: customerName,
          snapshot: {
            quantity: message.quoteData.quantity,
            designFee: message.quoteData.designFee,
            shippingFee: message.quoteData.shippingFee,
            deliveryMethod: message.quoteData.deliveryMethod,
            totalAmount: message.quoteData.totalAmount,
          },
        };
        order.statusHistory.push({
          status: 'Confirmed',
          timestamp: new Date(),
          notes: `Customer accepted quote ${message.messageId} via chat. Downpayment still owed.`,
          updatedBy: customerName,
        });
        order.updatedAt = new Date();
        await order.save();
      }

      // ── Update conversation preview
      const conversation = await Conversation.findOne({
        conversationId: message.conversationId,
      });
      if (conversation) {
        conversation.lastMessage =
          response === 'accepted'
            ? `✅ Accepted quote (${order.orderId})`
            : `❌ Rejected quote (${order.orderId})`;
        conversation.lastMessageAt = new Date();
        conversation.lastMessageBy = 'customer';
        conversation.adminUnreadCount += 1;
        conversation.customerUnreadCount = 0;
        await conversation.save();
      }

      return {
        success: true,
        message: `Quote ${response}`,
        data: { message, order, systemMessage },
      };
    } catch (error) {
      console.error('Error in respondToQuote:', error);
      throw error;
    }
  }


    // ─────────────────────────────────────────
  // LINK ORDER TO CONVERSATION
  // ─────────────────────────────────────────
  async linkOrderToConversation(conversationId, orderId, customerId) {
    console.log('Linking Order:', orderId)
    console.log('Customer Id:', customerId)
    console.log('Convo Id', conversationId)
    try {
      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) {
        return { success: false, message: 'Conversation not found' };
      }

      // Only the owning customer can link
      if (conversation.customerId !== customerId) {
        return { success: false, message: 'Access denied' };
      }

      // Verify the order belongs to this customer and is negotiable
      const order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: 'Order not found' };
      }
      if (order.orderedBy !== customerId) {
        return { success: false, message: 'Order does not belong to this customer' };
      }

      conversation.orderId = orderId;
      conversation.updatedAt = new Date();
      await conversation.save();

      return { success: true, message: 'Order linked to conversation', data: conversation };
    } catch (error) {
      console.error('Error linking order:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // HELPER: derive unit price from order items
  // ─────────────────────────────────────────
  _computeUnitPrice(order) {
    if (!order.items || order.items.length === 0) return 0;
    const first = order.items[0];
    if (!first.estimatedTotal || !first.quantity) return 0;
    return first.estimatedTotal / first.quantity;
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

    // ─────────────────────────────────────────
  // SEND PAYMENT REQUEST (admin → customer)
  //
  // Creates a payment-request message containing the GCash / bank details
  // pulled from env vars. Attaches it to the linked order so we can
  // prevent multiple concurrent requests.
  // ─────────────────────────────────────────
  async sendPaymentRequest(conversationId, admin, payload) {
    try {
      const { orderId, method, amountDue, notes } = payload;

      if (!orderId) return { success: false, message: 'orderId is required' };
      if (!['gcash', 'bank_transfer'].includes(method)) {
        return { success: false, message: 'Invalid payment method' };
      }
      if (!amountDue || Number(amountDue) <= 0) {
        return { success: false, message: 'amountDue must be greater than 0' };
      }

      const conversation = await Conversation.findOne({ conversationId });
      if (!conversation) return { success: false, message: 'Conversation not found' };

      const order = await Order.findOne({ orderId });
      if (!order) return { success: false, message: 'Order not found' };

      if (order.status !== 'Pending') {
        return { success: false, message: `Cannot request payment — order status is "${order.status}"` };
      }
      if (order.paymentStatus !== 'Unpaid') {
        return { success: false, message: `Cannot request payment — payment status is "${order.paymentStatus}"` };
      }
      if (order.activePaymentRequestMessageId) {
        return { success: false, message: 'A payment request is already active for this order' };
      }

      // Resolve account details from env
      const account = PaymentOptionsService.resolveAccountFor(method);
      if (!account || !account.accountName || !account.accountNumber) {
        return { success: false, message: 'Payment account not configured. Contact system admin.' };
      }

      const total = order.amount || order.totalAmount || 0;
      const amount = Number(amountDue);
      if (amount > total) {
        return { success: false, message: `Amount (₱${amount}) cannot exceed order total (₱${total})` };
      }

      const adminName = admin?.firstName
        ? `${admin.firstName} ${admin.lastName}`
        : admin?.email || 'Admin';

      // Supersede any prior pending payment-request in this conversation
      await Message.updateMany(
        {
          conversationId,
          contentType: 'payment-request',
          'paymentRequestData.orderId': orderId,
          'paymentRequestData.status': { $in: ['pending', 'proof-submitted'] },
        },
        { $set: { 'paymentRequestData.status': 'superseded' } }
      );

      const message = new Message({
        messageId: await generateId('MSG'),
        conversationId,
        senderType: 'admin',
        senderId: admin?.adminId || 'ADMIN',
        senderName: adminName,
        content: `Payment request for order ${orderId} — ₱${amount.toLocaleString()}`,
        contentType: 'payment-request',
        paymentRequestData: {
          orderId,
          method,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          bankName: account.bankName,
          amountDue: amount,
          notes: notes || '',
          status: 'pending',
          statusUpdatedAt: new Date(),
          statusUpdatedBy: adminName,
        },
        isDeleted: false,
        createdAt: new Date(),
      });
      await message.save();

      // Track as active on the order
      order.activePaymentRequestMessageId = message.messageId;
      order.updatedAt = new Date();
      order.updatedBy = adminName;
      await order.save();

      // Update conversation preview
      conversation.lastMessage = `💳 Payment request: ₱${amount.toLocaleString()}`;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageBy = 'admin';
      conversation.customerUnreadCount += 1;
      conversation.adminUnreadCount = 0;
      await conversation.save();

      return { success: true, data: message, order };
    } catch (error) {
      console.error('Error in sendPaymentRequest:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // SEND PAYMENT PROOF (customer → admin)
  //
  // Customer submits proof of payment. Only one proof per request allowed.
  // ─────────────────────────────────────────
  async sendPaymentProof(conversationId, customer, payload) {
    try {
      const {
        paymentRequestMessageId,
        amountPaid,
        referenceNumber,
        proofImageUrl,
        note,
      } = payload;

      if (!paymentRequestMessageId) return { success: false, message: 'paymentRequestMessageId is required' };
      if (!proofImageUrl) return { success: false, message: 'proofImageUrl is required' };

      const requestMsg = await Message.findOne({ messageId: paymentRequestMessageId });
      if (!requestMsg || requestMsg.contentType !== 'payment-request') {
        return { success: false, message: 'Payment request not found' };
      }
      if (requestMsg.paymentRequestData.status !== 'pending') {
        return { success: false, message: `This request is already "${requestMsg.paymentRequestData.status}"` };
      }

      const orderId = requestMsg.paymentRequestData.orderId;
      const order = await Order.findOne({ orderId });
      if (!order) return { success: false, message: 'Order not found' };
      if (order.status !== 'Pending') {
        return { success: false, message: `Order is no longer Pending (status: ${order.status})` };
      }

      const customerName = customer?.firstName
        ? `${customer.firstName} ${customer.lastName}`
        : customer?.email || 'Customer';

      // Enforce: customer cannot alter the amountDue
      const finalAmount = requestMsg.paymentRequestData.amountDue;

      const proofMsg = new Message({
        messageId: await generateId('MSG'),
        conversationId,
        senderType: 'customer',
        senderId: customer?.customerId || 'CUST',
        senderName: customerName,
        content: `Payment proof submitted — ₱${finalAmount.toLocaleString()}`,
        contentType: 'payment-proof',
        paymentProofData: {
          paymentRequestMessageId,
          orderId,
          method: requestMsg.paymentRequestData.method,
          amountPaid: finalAmount,
          referenceNumber: referenceNumber || '',
          proofImageUrl,
          note: note || '',
          submittedAt: new Date(),
          status: 'pending-review',
        },
        isDeleted: false,
        createdAt: new Date(),
      });
      await proofMsg.save();

      // Update the request message
      requestMsg.paymentRequestData.status = 'proof-submitted';
      requestMsg.paymentRequestData.statusUpdatedAt = new Date();
      requestMsg.paymentRequestData.statusUpdatedBy = customerName;
      await requestMsg.save();

      // Update conversation preview
      const conversation = await Conversation.findOne({ conversationId });
      if (conversation) {
        conversation.lastMessage = `📎 Payment proof — ₱${finalAmount.toLocaleString()}`;
        conversation.lastMessageAt = new Date();
        conversation.lastMessageBy = 'customer';
        conversation.adminUnreadCount += 1;
        conversation.customerUnreadCount = 0;
        if (['resolved', 'closed'].includes(conversation.status)) {
          conversation.status = 'open';
        }
        await conversation.save();
      }

      return { success: true, data: proofMsg, requestMessage: requestMsg };
    } catch (error) {
      console.error('Error in sendPaymentProof:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // REJECT PAYMENT PROOF (admin)
  // ─────────────────────────────────────────
  async rejectPaymentProof(proofMessageId, admin, reason = '') {
    try {
      const proofMsg = await Message.findOne({ messageId: proofMessageId });
      if (!proofMsg || proofMsg.contentType !== 'payment-proof') {
        return { success: false, message: 'Payment proof not found' };
      }
      if (proofMsg.paymentProofData.status !== 'pending-review') {
        return { success: false, message: `Proof already ${proofMsg.paymentProofData.status}` };
      }

      const adminName = admin?.firstName
        ? `${admin.firstName} ${admin.lastName}`
        : admin?.email || 'Admin';

      proofMsg.paymentProofData.status = 'rejected';
      proofMsg.paymentProofData.reviewedAt = new Date();
      proofMsg.paymentProofData.reviewedBy = adminName;
      proofMsg.paymentProofData.rejectionReason = reason || 'No reason provided';
      await proofMsg.save();

      // Reopen the request so customer can resubmit
      const requestMsg = await Message.findOne({
        messageId: proofMsg.paymentProofData.paymentRequestMessageId,
      });
      if (requestMsg) {
        requestMsg.paymentRequestData.status = 'rejected';
        requestMsg.paymentRequestData.rejectionReason = reason || 'No reason provided';
        requestMsg.paymentRequestData.statusUpdatedAt = new Date();
        requestMsg.paymentRequestData.statusUpdatedBy = adminName;
        await requestMsg.save();
      }

      // Create a system message explaining the rejection in-chat
      const systemMsg = new Message({
        messageId: await generateId('MSG'),
        conversationId: proofMsg.conversationId,
        senderType: 'admin',
        senderId: admin?.adminId || 'ADMIN',
        senderName: adminName,
        content: `❌ Payment proof rejected${reason ? `: ${reason}` : ''}. Please re-submit or contact support.`,
        contentType: 'system',
        isDeleted: false,
        createdAt: new Date(),
      });
      await systemMsg.save();

      // Clear the active flag on the order so a new request can be sent
      await Order.updateOne(
        { orderId: proofMsg.paymentProofData.orderId },
        { $set: { activePaymentRequestMessageId: null } }
      );

      return { success: true, data: proofMsg, requestMessage: requestMsg, systemMessage: systemMsg };
    } catch (error) {
      console.error('Error in rejectPaymentProof:', error);
      throw error;
    }
  }
}

module.exports = new ChatService();