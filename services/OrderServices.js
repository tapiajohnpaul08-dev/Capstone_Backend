// services/OrderService.js
const mongoose = require("mongoose");
const Order = require("../models/Order.Model");
const InventoryItem = require("../models/InventoryItem.Model");
const Product = require("../models/Product.Model");
const Driver = require("../models/Driver.Model");
const DriverService = require("./DriverServices");
const Customer = require("../models/Customer.Model");
const generateId = require("../utils/generateItemId");

const Message = require('../models/Message.Model');

const { emitOrderChanged, emitInventoryChanged } = require('../utils/realtime');

// ─── Constants ──────────────────────────────────────────────────────────────
const DESIGN_AND_PRINTING_FEE = 500;

// Emoji toggles for the auto-greeting — set to '' to disable any
const GREETING_EMOJI = {
  wave: '👋',
  party: '🎉',
};

// ─── Status constants ──────────────────────────────────────────────────────
const VALID_STATUSES = [
  "Pending",
  "Confirmed",
  "Scheduled",
  "In Production",
  "Out for Delivery",
  "Completed",
  "Cancelled",
];

const STATUS_FLOW = ["Pending", "Confirmed", "Scheduled", "In Production", "Out for Delivery", "Completed"];

function normalizeIncomingStatus(status) {
  if (status === "Ready to Pick-up") return "Out for Delivery";
  return status;
}

function isValidTransition(currentStatus, nextStatus) {
  if (nextStatus === "Cancelled") return true;
  if (nextStatus === currentStatus) return true;
  const currentIdx = STATUS_FLOW.indexOf(currentStatus);
  const nextIdx = STATUS_FLOW.indexOf(nextStatus);
  if (currentIdx === -1 || nextIdx === -1) return false;
  return nextIdx === currentIdx + 1;
}

/**
 * Helper: determine if an item has a design
 */
function hasValidDesign(item) {
  if (!item) return false;
  if (item.designSource === 'no-design') return false;
  if (item.designSource === 'upload' || item.designSource === 'saved') return true;
  if (item.files && item.files.length > 0) return true;
  if (item.designImage && item.designImage.length > 0) return true;
  if (item.selectedTemplateId || item.selectedTemplate) return true;
  if (item.designNotes && item.designNotes.trim().length > 0) {
    if (item.designNotes !== 'No design - plain product, as is.' &&
        item.designNotes !== 'No design - plain product as is') {
      return true;
    }
  }
  return false;
}

function hasItemPhoto(item) {
  if (!item) return false;

  if (Array.isArray(item.itemPhotos)) {
    const hasAny = item.itemPhotos.some(
      (u) => typeof u === 'string' && u.trim(),
    );
    if (hasAny) return true;
  }

  if (typeof item.itemPhoto === 'string' && item.itemPhoto.trim()) {
    return true;
  }

  return false;
}
class OrderService {
  _getUnitPriceForQuantity(sizeObj, qty) {
    if (!sizeObj) return 0;
    if (qty >= 5000 && sizeObj.bulkPrices?.[5000]) return sizeObj.bulkPrices[5000] / 5000;
    if (qty >= 2000 && sizeObj.bulkPrices?.[2000]) return sizeObj.bulkPrices[2000] / 2000;
    if (qty >= 1000 && sizeObj.bulkPrices?.[1000]) return sizeObj.bulkPrices[1000] / 1000;
    if (qty >= 500 && sizeObj.bulkPrices?.[500]) return sizeObj.bulkPrices[500] / 500;
    return sizeObj.price;
  }

  // ✅ FIX #1 — Payment ledger helpers (single source of truth)
  _computeOrderTotal(order) {
    return Number(order.amount) || Number(order.totalAmount) || 0;
  }

  _computeTotalPaid(order) {
    if (!Array.isArray(order.partialPayments)) return 0;
    return order.partialPayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0,
    );
  }

  _computeRemainingBalance(order) {
    const total = this._computeOrderTotal(order);
    const paid = this._computeTotalPaid(order);
    return Math.max(0, total - paid);
  }

  // ─────────────────────────────────────────────────────────────────
  // ✅ NEW — Auto-link the order to a chat conversation
  // Called right after a new order is saved. Ensures the customer has
  // an open conversation with admin bound to this order, so the admin's
  // NegotiationPanel appears immediately without the customer having
  // to manually pick a Pending order.
  // ─────────────────────────────────────────────────────────────────
  // ✅ SIMPLIFIED — Per-order conversations.
  // Every order gets its OWN conversation. We look up the customer,
  // then delegate to ChatServices.getOrCreateConversation() which
  // handles per-order matching (reuses if a conversation for this
  // specific order already exists).
  async _autoLinkOrderToConversation(order) {
    try {
      if (!order) return;

      const chatService = require('./ChatServices');

      // ── Resolve the customer ─────────────────────────────────────
      // Priority order:
      //   1. orderedBy (Mongo _id) — set by createOrder, always reliable
      //   2. Fall back to customerEmail lookup
      // This handles the case where the customer checks out with a
      // shipping email that differs from their account email.
      let customer = null;

      if (order.orderedBy) {
        try {
          customer = await Customer.findById(order.orderedBy);
        } catch (e) {
          // orderedBy may be a customerId string in some legacy records
          customer = await Customer.findOne({ customerId: order.orderedBy });
        }
      }

      if (!customer && order.customerEmail) {
        customer = await Customer.findOne({
          email: order.customerEmail.toLowerCase(),
        });
      }

      if (!customer) {
        console.warn(
          `⚠️ Auto-link skipped for order ${order.orderId} — ` +
          `no registered customer found (orderedBy=${order.orderedBy}, email=${order.customerEmail})`,
        );
        return;
      }

      const chatCustomerId = customer.customerId;
      if (!chatCustomerId) {
        console.warn(
          `⚠️ Auto-link skipped for order ${order.orderId} — ` +
          `customer ${customer._id} has no customerId`,
        );
        return;
      }

      // Use the real customer name and email (not the order's
      // possibly-overwritten shipping fields)
      const customerName =
        `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
        customer.email;
      const customerEmail = customer.email;

      // getOrCreateConversation guarantees ONE conversation per order.
      const result = await chatService.getOrCreateConversation(
        chatCustomerId,
        customerName,
        customerEmail,
        `Order ${order.orderId}`,
        order.orderId,
      );

      if (result?.success && result.data) {
        // ✅ Only greet if this is a fresh conversation. If the conversation
        // already had messages (meaning the customer and admin had already
        // started talking), we don't want to spam them with a greeting every
        // time the order doc is touched.
        const isNewConversation = !result.data.lastMessage ||
                                   result.data.lastMessage.trim() === '';

        if (isNewConversation) {
          await this._sendOrderGreeting(result.data, order, customerName);
        }
      }
    } catch (err) {
      // Never let chat linking break order creation
      console.error('Auto-link order to conversation failed:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ✅ NEW — Send the admin's auto-greeting to the customer
  //
  // Fires right after a new per-order conversation is created. The
  // message is sent as the "admin" so it shows up on the customer's
  // admin-message side and triggers their unread badge.
  // ─────────────────────────────────────────────────────────────────
  async _sendOrderGreeting(conversation, order, customerName) {
    try {
      const chatService = require('./ChatServices');

      // Format the order amount nicely
      const amount = order.amount || order.totalAmount || 0;
      const formattedAmount = Number(amount).toLocaleString('en-PH');

      // Pull the customer's first name for a personal touch
      const firstName = (customerName || '').split(' ')[0] || 'there';

      // A short, professional greeting. Kept friendly but not too casual.
      const greeting =
        `Hi ${firstName}! ${GREETING_EMOJI.wave}\n\n` +
        `Thank you for placing order ${order.orderId} with ACAPSHOP. ` +
        `We've received your request and we're excited to work with you.\n\n` +
        `To make sure everything is exactly right, we'll use this chat to ` +
        `review the details together — including:\n` +
        `• Final pricing and any adjustments\n` +
        `• Design placement and print specifications\n` +
        `• Delivery or pickup arrangements\n\n` +
        `The current estimated total is ₱${formattedAmount}. ` +
        `This is a starting estimate — we'll confirm the final price with you ` +
        `before any payment is made.\n\n` +
        `Feel free to reply here with any questions, and we'll respond as ` +
        `soon as possible. Thank you for choosing ACAPSHOP! 🎉`;

      const result = await chatService.sendMessage(
        conversation.conversationId,
        'admin',                            // senderId (matches adminName flow)
        'ACAPSHOP Support',                 // senderName
        'admin',                            // senderType
        greeting,
        [],                                 // attachments
        null,                               // replyToMessageId
      );

      if (result?.success) {
      } else {
        console.warn(
          `⚠️ Auto-greeting failed for ${order.orderId}: ${result?.message || 'unknown error'}`,
        );
      }
    } catch (err) {
      // Non-fatal: never break order creation because of a chat message
      console.error('Failed to send auto-greeting:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // ✅ NEW — totalSpent tracking
  // Applies a delta to the customer's totalSpent field. Accepts either
  // a delta (positive/negative number) OR the before/after totals to
  // compute the delta automatically.
  // ─────────────────────────────────────────────────────────────────
  async _applyTotalSpentDelta(order, delta) {
    if (!delta || isNaN(delta) || delta === 0) return;

    try {
      // Find the customer by orderedBy (mongo _id) or customerEmail
      let customer = null;

      if (order.orderedBy) {
        customer = await Customer.findById(order.orderedBy);
      }
      if (!customer && order.customerEmail) {
        customer = await Customer.findOne({ email: order.customerEmail.toLowerCase() });
      }

      if (!customer) {
        console.warn(
          `⚠️ Cannot update totalSpent — no customer found for order ${order.orderId} (orderedBy: ${order.orderedBy}, email: ${order.customerEmail})`,
        );
        return;
      }

      // ✅ Atomic increment — avoids a read-modify-write race when two
      // payment events land in parallel (e.g. downpayment verified while
      // an order is being marked Completed in another tab).
      const result = await Customer.updateOne(
        { _id: customer._id },
        {
          $inc: { totalSpent: delta },
          $set: { updatedAt: new Date() },
        },
      );

    } catch (err) {
      // Non-fatal: don't break the order flow if totalSpent update fails
      console.error('Error updating customer totalSpent:', err);
    }
  }

  // ─────────────────────────────────────────
  // CREATE ORDER (updated: no auto-downpayment, server-computed amount)
  // ─────────────────────────────────────────
  async createOrder(payload, user = null, userType = null) {
    
    const session = await mongoose.startSession();
    try {

      let orderedById;
      let customerEmail = payload.customerEmail;
      let customerName = payload.customerName;
      let customerPhone = payload.customerPhone;
      let customerId = null;

      const customer = await Customer.findOne({ email: customerEmail });


      // ─── Get or find customer ──────────────────────────────────────────
      if (user && userType === "customer") {
        orderedById = user._id.toString();
        customerEmail = customerEmail || user.email;
        customerName = customerName || user.name;
        customerPhone = customerPhone || user.phone;

        const customer = await Customer.findOne({ _id: user._id });
        if (customer) {
          customerId = customer._id;
        } else {
          console.warn(`⚠️ Customer not found for user ID: ${user._id}`);
        }
      } else if (customerEmail) {
        const customer = await Customer.findOne({ email: customerEmail });
        if (customer) {
          customerId = customer._id;
          orderedById = customer._id.toString();
        } else {
          console.warn(`⚠️ Customer not found for email: ${customerEmail}`);
        }
      }

      if (!customerEmail) {
        return { success: false, message: "Customer email is required" };
      }

      // ─── Calculate expected delivery ──────────────────────────────────
      let expectedDelivery;
      if (payload.preferredDate) {
        expectedDelivery = new Date(payload.preferredDate);
        const minDate = this.getBusinessDaysFromToday(3);
        if (expectedDelivery < minDate) expectedDelivery = minDate;
        const maxDate = this.getBusinessDaysFromToday(7);
        if (expectedDelivery > maxDate) expectedDelivery = maxDate;
      } else {
        expectedDelivery = this.calculateExpectedDelivery(payload.receivingMode);
      }

      let newOrder = null;

      // ─── Own-cups orders ──────────────────────────────────────────────
      if (payload.isProvided === true) {
        const firstItem = payload.items && payload.items.length > 0 ? payload.items[0] : {};
        const providedId = await generateId("ORD");


        const hasItemPhotoUploaded =
          hasItemPhoto(firstItem) || hasItemPhoto(payload);

        if (!hasItemPhotoUploaded) {
          return {
            success: false,
            message:
              'Please upload at least one photo of your own item — we need to see what it looks like before we can print on it.',
            code: 'ITEM_PHOTO_REQUIRED',
          };
        }

        // OWN CUPS: ₱500 flat fee (design + printing service)
        const designFee = DESIGN_AND_PRINTING_FEE;
        const shippingFee = Number(payload.shippingFee) || 0;
        const serverAmount = designFee + shippingFee;

        const hasDesign = hasValidDesign(firstItem) || hasValidDesign(payload);

        const designDetails = {
          designSource: firstItem.designSource || payload.designSource || "upload",
          designImage: firstItem.designImage || payload.designImage || "",
          printSize: firstItem.printSize || payload.printSize || "",
          printPlacement: firstItem.printPlacement || payload.printPlacement || "",
          designNotes: firstItem.designNotes || payload.designNotes || "",
          files: firstItem.files || payload.files || [],
        };

        newOrder = new Order({
          orderId: `${providedId}-PROV`,
          customerName,
          customerEmail,
          customerPhone,
          address: payload.address,
          useCourier: payload.useCourier,
          courierName: payload.courierName,
          postalCode: payload.postalCode || "",
          items: [
            {
              productId: null,
              name: firstItem.name || payload.productName || "Customer Provided Items",
              category: "Customer Provided",
              size: firstItem.size || payload.size || "Custom",
              quantity: firstItem.quantity || payload.quantity,
              designSource: firstItem.designSource || payload.designSource || "upload",
              designImage: firstItem.designImage || payload.designImage || "",
              printSize: firstItem.printSize || payload.printSize || "",
              printPlacement: firstItem.printPlacement || payload.printPlacement || "",
              designNotes: firstItem.designNotes || payload.designNotes || "",
              files: firstItem.files || payload.files || [],
              selectedTemplateId: firstItem.selectedTemplateId || null,
              selectedTemplate: firstItem.selectedTemplate || null,

              // ✅ NEW — Carry the customer's own-item photos through
              // to the stored order. Normalize both accepted shapes
              // (itemPhotos array, or single itemPhoto string) into
              // one array so downstream code only reads one field.
              itemPhotos: (() => {
                const arr = Array.isArray(firstItem.itemPhotos)
                  ? firstItem.itemPhotos.filter((u) => typeof u === 'string' && u.trim())
                  : [];
                if (arr.length) return arr;
                if (typeof firstItem.itemPhoto === 'string' && firstItem.itemPhoto.trim()) {
                  return [firstItem.itemPhoto.trim()];
                }
                // Top-level fallback for backward compat
                const topArr = Array.isArray(payload.itemPhotos)
                  ? payload.itemPhotos.filter((u) => typeof u === 'string' && u.trim())
                  : [];
                if (topArr.length) return topArr;
                if (typeof payload.itemPhoto === 'string' && payload.itemPhoto.trim()) {
                  return [payload.itemPhoto.trim()];
                }
                return [];
              })(),

              // Cloudinary public IDs (optional — empty if frontend
              // didn't send them; cleanup will just be skipped)
              itemPhotoPublicIds: Array.isArray(firstItem.itemPhotoPublicIds)
                ? firstItem.itemPhotoPublicIds
                : Array.isArray(payload.itemPhotoPublicIds)
                  ? payload.itemPhotoPublicIds
                  : [],

              estimatedTotal: 0,
            },
          ],
          designDetails: [designDetails],
          hasDesign: hasDesign,
          quantity: firstItem.quantity || payload.quantity,
          amount: serverAmount,
          totalAmount: serverAmount,
          designFee: designFee,
          shippingFee: shippingFee,
          downpayment: 0,
          status: "Pending",
          paymentStatus: "Unpaid",
          receivingMode: payload.receivingMode,
          expectedDelivery,
          preferredDate: payload.preferredDate || null,
          fromCustomerToCompanyDeliveryDate: payload.fromCustomerToCompanyDeliveryDate || null,
          isProvided: true,

          // ✅ NEW — Top-level snapshot mirrors items[0].itemPhotos
          itemPhotos: (() => {
            const arr = Array.isArray(firstItem.itemPhotos)
              ? firstItem.itemPhotos.filter((u) => typeof u === 'string' && u.trim())
              : [];
            if (arr.length) return arr;
            if (typeof firstItem.itemPhoto === 'string' && firstItem.itemPhoto.trim()) {
              return [firstItem.itemPhoto.trim()];
            }
            const topArr = Array.isArray(payload.itemPhotos)
              ? payload.itemPhotos.filter((u) => typeof u === 'string' && u.trim())
              : [];
            if (topArr.length) return topArr;
            if (typeof payload.itemPhoto === 'string' && payload.itemPhoto.trim()) {
              return [payload.itemPhoto.trim()];
            }
            return [];
          })(),

          orderedBy: orderedById,
          notes: payload.notes || "Customer provided items for printing",
          statusHistory: [
            {
              status: "Pending",
              timestamp: new Date(),
              notes: "Order created (customer provided items)",
              updatedBy: `Customer`,
            },
          ],
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            company: payload.customer?.company || "",
          },
          paymentMethod: payload.paymentMethod || "cod",
          paymentDetails: payload.paymentDetails || null,
          partialPayments: [],
        });

        await newOrder.save();

        if (customerId) {
          await Customer.findByIdAndUpdate(customerId, {
            $push: { orders: newOrder._id }
          });
        }

        // ✅ Auto-link the new order to the customer's chat thread
        await this._autoLinkOrderToConversation(newOrder);

        // ✅ Realtime — notify admins + the customer
        emitOrderChanged(newOrder, 'created');
        emitInventoryChanged({ reason: 'order-created', orderId: newOrder.orderId });

        return { success: true, message: "Order created successfully", data: newOrder };
      }

      // ─── Company-product orders ──────────────────────────────────────
      const itemsToProcess = payload.items || [
        {
          productId: payload.productId,
          name: payload.productName,
          category: payload.category,
          size: payload.size,
          quantity: payload.quantity,
          designSource: payload.designSource || "upload",
          printSize: payload.printSize || "",
          printPlacement: payload.printPlacement || "",
          designNotes: payload.designNotes || "",
          files: payload.files || [],
          selectedTemplate: payload.selectedTemplate || null,
          selectedTemplateId: payload.selectedTemplateId || null,
        },
      ];

      let txnResult;

      try {
        await session.withTransaction(async () => {
          const processedItems = [];
          let productTotal = 0;
          let hasDesign = false;

          for (const item of itemsToProcess) {
            const product = await Product.findOne({ id: item.productId }).session(session);
            if (!product) {
              throw Object.assign(new Error(`Product not found: ${item.name}`), { handled: true });
            }

            const sizeObj = product.sizes.find((s) => s.name === item.size);
            if (!sizeObj) {
              throw Object.assign(
                new Error(`Size "${item.size}" not found for ${item.name}`),
                { handled: true },
              );
            }

            if (sizeObj.stock < item.quantity) {
              throw Object.assign(
                new Error(`Insufficient stock for ${item.name} - ${item.size}. Available: ${sizeObj.stock}`),
                { handled: true },
              );
            }

            const unitPrice = this._getUnitPriceForQuantity(sizeObj, item.quantity);
            const itemTotal = unitPrice * item.quantity;
            productTotal += itemTotal;

            if (hasValidDesign(item)) hasDesign = true;

            processedItems.push({
              productId: item.productId,
              name: item.name,
              category: product.category,
              size: item.size,
              quantity: item.quantity,
              designSource: item.designSource || "upload",
              designImage: item.designImage || "",
              printSize: item.printSize || "",
              printPlacement: item.printPlacement || "",
              designNotes: item.designNotes || "",
              files: item.files || [],
              selectedTemplate: item.selectedTemplate || null,
              selectedTemplateId: item.selectedTemplateId || null,
              estimatedTotal: itemTotal,
              image: product.image,
               // ✅ NEW
  rimDiameter: item.rimDiameter ?? sizeObj.rimDiameter ?? null,
  itemType: item.itemType || 'cup',
            });

            sizeObj.stock -= item.quantity;
            await product.save({ session });
          }

          const designFee = hasDesign ? DESIGN_AND_PRINTING_FEE : 0;
          const shippingFee = Number(payload.shippingFee) || 0;
          const serverAmount = productTotal + designFee + shippingFee;

          // One designDetails entry PER item so cart orders with multiple
          // designs each keep their own image, files, and print specs.
          const designDetails = processedItems.map((it) => ({
            designSource:    it.designSource    || "upload",
            designImage:     it.designImage     || "",
            printSize:       it.printSize       || "",
            printPlacement:  it.printPlacement  || "",
            designNotes:     it.designNotes     || "",
            files:           it.files           || [],
            imagePaths:      (it.files || []).map((f) => f.path).filter(Boolean),
            selectedTemplate:   it.selectedTemplate   || null,
            selectedTemplateId: it.selectedTemplateId || null,
          }));

          const OrderId = await generateId("ORD");

          newOrder = new Order({
            orderId: `${OrderId}-COMP`,
            customerName,
            customerEmail,
            customerPhone,
            address: payload.address,
            useCourier: payload.useCourier,
            courierName: payload.courierName,
            postalCode: payload.postalCode || "",
            items: processedItems,
            hasDesign: hasDesign,
            designDetails: [designDetails],
            quantity: processedItems.reduce((sum, i) => sum + i.quantity, 0),
            amount: serverAmount,
            totalAmount: serverAmount,
            designFee: designFee,
            shippingFee: shippingFee,
            downpayment: 0,
            status: "Pending",
            paymentStatus: "Unpaid",
            receivingMode: payload.receivingMode,
            expectedDelivery,
            preferredDate: payload.preferredDate || null,
            isProvided: false,
            orderedBy: orderedById,
            notes: payload.notes || `Order with ${processedItems.length} item(s)`,
            statusHistory: [
              { status: "Pending", timestamp: new Date(), notes: "Order created", updatedBy: `Customer` },
            ],
            customer: {
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
              company: payload.customer?.company || "",
            },
            paymentMethod: payload.paymentMethod || "cod",
            paymentDetails: payload.paymentDetails || null,
            partialPayments: [],
          });

          await newOrder.save({ session });

          if (customerId) {
            await Customer.findByIdAndUpdate(customerId, {
              $push: { orders: newOrder._id }
            }).session(session);
          }
        });

        // ✅ Auto-link AFTER the transaction commits (not inside it,
        //    because chat writes are outside the session).
        if (newOrder) {
          await this._autoLinkOrderToConversation(newOrder);
          emitOrderChanged(newOrder, 'created');
          emitInventoryChanged({ reason: 'order-created', orderId: newOrder.orderId });
        }
      } catch (txnErr) {
        if (txnErr.handled) {
          txnResult = { success: false, message: txnErr.message };
        } else {
          console.warn(
            "⚠️ Transaction failed/unsupported, falling back to non-transactional order creation:",
            txnErr.message,
          );
          return await this._createCompanyOrderWithoutTransaction(
            itemsToProcess,
            { customerName, customerEmail, customerPhone, orderedById, payload, expectedDelivery, customerId },
          );
        }
      } finally {
        session.endSession();
      }

      if (txnResult) return txnResult;

      return { success: true, message: "Order created successfully", data: newOrder };
    } catch (error) {
      console.error("❌ Error creating order:", error);
      if (session) session.endSession();
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // CREATE COMPANY ORDER WITHOUT TRANSACTION (Fallback)
  // ─────────────────────────────────────────
  async _createCompanyOrderWithoutTransaction(itemsToProcess, ctx) {
    const { customerName, customerEmail, customerPhone, orderedById, payload, expectedDelivery, customerId } = ctx;
    const processedItems = [];
    let productTotal = 0;
    let hasDesign = false;

    for (const item of itemsToProcess) {
      const product = await Product.findOne({ id: item.productId });
      if (!product) return { success: false, message: `Product not found: ${item.name}` };

      const sizeObj = product.sizes.find((s) => s.name === item.size);
      if (!sizeObj) return { success: false, message: `Size "${item.size}" not found for ${item.name}` };

      if (sizeObj.stock < item.quantity) {
        return {
          success: false,
          message: `Insufficient stock for ${item.name} - ${item.size}. Available: ${sizeObj.stock}`,
        };
      }

      // ✅ NEW — reject mismatched rimDiameter from tampered payloads
if (
  item.rimDiameter != null &&
  sizeObj.rimDiameter != null &&
  item.rimDiameter !== sizeObj.rimDiameter
) {
  throw Object.assign(
    new Error(`Rim diameter mismatch for ${item.name} - ${item.size}`),
    { handled: true },
  );
}

      const unitPrice = this._getUnitPriceForQuantity(sizeObj, item.quantity);
      const itemTotal = unitPrice * item.quantity;
      productTotal += itemTotal;

      if (hasValidDesign(item)) hasDesign = true;

      processedItems.push({
        productId: item.productId,
        name: item.name,
        category: product.category,
        size: item.size,
        quantity: item.quantity,
        designSource: item.designSource || "upload",
        designImage: item.designImage || "",
        printSize: item.printSize || "",
        printPlacement: item.printPlacement || "",
        designNotes: item.designNotes || "",
        files: item.files || [],
        selectedTemplate: item.selectedTemplate || null,
        selectedTemplateId: item.selectedTemplateId || null,
        estimatedTotal: itemTotal,
        image: product.image,
                // ✅ NEW — mirror the transaction path
        rimDiameter: item.rimDiameter ?? sizeObj.rimDiameter ?? null,
        itemType: item.itemType || 'cup',
      });

      sizeObj.stock -= item.quantity;
      await product.save();
    }

    const designFee = hasDesign ? DESIGN_AND_PRINTING_FEE : 0;
    const shippingFee = Number(payload.shippingFee) || 0;
    const serverAmount = productTotal + designFee + shippingFee;

    const designDetails = processedItems.map((it) => ({
      designSource:    it.designSource    || "upload",
      designImage:     it.designImage     || "",
      printSize:       it.printSize       || "",
      printPlacement:  it.printPlacement  || "",
      designNotes:     it.designNotes     || "",
      files:           it.files           || [],
      imagePaths:      (it.files || []).map((f) => f.path).filter(Boolean),
      selectedTemplate:   it.selectedTemplate   || null,
      selectedTemplateId: it.selectedTemplateId || null,
    }));

    const OrderId = await generateId("ORD");
    const newOrder = new Order({
      orderId: `${OrderId}-COMP`,
      customerName,
      customerEmail,
      customerPhone,
      address: payload.address,
      useCourier: payload.useCourier,
      courierName: payload.courierName,
      postalCode: payload.postalCode || "",
      items: processedItems,
      hasDesign: hasDesign,
      designDetails: [designDetails],
      quantity: processedItems.reduce((sum, i) => sum + i.quantity, 0),
      amount: serverAmount,
      totalAmount: serverAmount,
      designFee: designFee,
      shippingFee: shippingFee,
      downpayment: 0,
      status: "Pending",
      paymentStatus: "Unpaid",
      receivingMode: payload.receivingMode,
      expectedDelivery,
      preferredDate: payload.preferredDate || null,
      isProvided: false,
      orderedBy: orderedById,
      notes: payload.notes || `Order with ${processedItems.length} item(s)`,
      statusHistory: [{ status: "Pending", timestamp: new Date(), notes: "Order created", updatedBy: `Customer` }],
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        company: payload.customer?.company || "",
      },
      paymentMethod: payload.paymentMethod || "cod",
      paymentDetails: payload.paymentDetails || null,
      partialPayments: [],
    });

    await newOrder.save();

    if (customerId) {
      await Customer.findByIdAndUpdate(customerId, {
        $push: { orders: newOrder._id }
      });
    }

    // ✅ Auto-link the new order to the customer's chat thread
    await this._autoLinkOrderToConversation(newOrder);
    emitOrderChanged(newOrder, 'created');
    emitInventoryChanged({ reason: 'order-created', orderId: newOrder.orderId });
    return { success: true, message: "Order created successfully", data: newOrder };
  }

  // ─────────────────────────────────────────
  // CALCULATE EXPECTED DELIVERY DATE
  // ─────────────────────────────────────────
  calculateExpectedDelivery(receivingMode) {
    const now = new Date();
    let daysToAdd = 7;
    if (receivingMode === "Pick-up") daysToAdd = 5;
    else if (receivingMode === "Delivery") daysToAdd = 6;

    let result = new Date(now);
    let daysAdded = 0;
    while (daysAdded < daysToAdd) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) daysAdded++;
    }
    return result;
  }

  getBusinessDaysFromToday(days) {
    const date = new Date();
    let businessDaysAdded = 0;
    while (businessDaysAdded < days) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) businessDaysAdded++;
    }
    return date;
  }

  // ─────────────────────────────────────────
  // UPDATE ORDER STATUS
  // ─────────────────────────────────────────
  async updateOrderStatus(
    orderId,
    newStatus,
    notes,
    productionSchedule = null,
    driverId = null,
    user = null,
    options = {}
  ) {
    const { codCollected = false } = options;    try {
      newStatus = normalizeIncomingStatus(newStatus);

      if (!VALID_STATUSES.includes(newStatus)) {
        return { success: false, message: "Invalid status" };
      }

      let order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: "Order not found" };
      }

      if (newStatus === 'Confirmed' && order.paymentStatus === 'Unpaid') {
        return {
          success: false,
          message: 'Cannot confirm an order before a downpayment is verified. Use the payment verification flow in chat.',
        };
      }

      // ✅ FIX #1b — Strict guard: refuse to complete a Partial order
      // unless the caller confirms the remaining balance was collected.
      if (newStatus === "Completed") {
        const needsCodCollection = order.paymentStatus === "Partial";

        if (needsCodCollection && codCollected !== true) {
          return {
            success: false,
            message:
              "This order still has an unpaid balance. Please confirm the remaining balance has been collected before completing.",
          };
        }

        // Flip to Paid — updatePaymentStatus records the remaining
        // balance in partialPayments.
        const paymentResult = await this.updatePaymentStatus(
          orderId, "Paid", order.totalAmount, user
        );

        // ✅ CRITICAL — Replace our local `order` with the FRESH doc that
        // updatePaymentStatus loaded + saved. That doc has:
        //   • the current __v (incremented by the inner save)
        //   • the updated paymentStatus / partialPayments / paymentDetails
        //
        // Without replacing the doc, our final order.save() at the end of
        // this function would try to write against a stale __v and throw
        // a Mongoose VersionError — which aborts the status change
        // entirely (order remains "Out for Delivery" in the DB even
        // though the driver clicked Complete).
        if (paymentResult.success && paymentResult.data) {
          order = paymentResult.data;
        }
      }

      if (order.status === "Completed" || order.status === "Cancelled") {
        return {
          success: false,
          message: `Cannot change status of a ${order.status.toLowerCase()} order`,
        };
      }

      if (!isValidTransition(order.status, newStatus)) {
        return {
          success: false,
          message: `Cannot move order from "${order.status}" to "${newStatus}". Valid next step: "${
            STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1] || "Cancelled"
          }" or "Cancelled".`,
        };
      }

      const oldStatus = order.status;

      if (newStatus === "Scheduled") {
        const scheduleValue = productionSchedule || order.productionSchedule;
        if (!scheduleValue) {
          return { success: false, message: "A production schedule date is required to move to Scheduled" };
        }
        const scheduleDate = new Date(scheduleValue);
        if (Number.isNaN(scheduleDate.getTime())) {
          return { success: false, message: "Invalid production schedule date" };
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (scheduleDate < today) {
          return { success: false, message: "Production schedule cannot be in the past" };
        }
        order.productionSchedule = scheduleDate;
      }

      if (newStatus === "Out for Delivery" && order.receivingMode === "Delivery") {
        if (!driverId) {
          return { success: false, message: "A driver must be assigned before marking as Out for Delivery" };
        }

        const driver = await Driver.findOne({ driverId });
        if (!driver) return { success: false, message: "Driver not found" };
        if (!driver.available) return { success: false, message: "Driver is not available" };

        order.driverDetails = {
          driverId: driver.driverId,
          driverName: driver.fullName || `${driver.firstName} ${driver.lastName}`,
          driverPhone: driver.phoneNumber,
          plateNumber: driver.plateNumber,
          truckDescription: driver.vehicleDescription || "",
          assignedAt: new Date(),
        };

        const incrementResult = await DriverService.incrementAssignedOrders(driverId);
        if (!incrementResult.success) {
          return { success: false, message: incrementResult.message };
        }
      }

      if ((newStatus === "Completed" || newStatus === "Cancelled") && order.driverDetails?.driverId) {
        const decrementResult = await DriverService.decrementAssignedOrders(order.driverDetails.driverId);
        if (decrementResult.success) {
        } else {
          console.warn(`⚠️ Could not release driver ${order.driverDetails.driverId}: ${decrementResult.message}`);
        }
      }

      // ─── Restore stock on fresh cancellation ──────────────────────────
      // Only company-product orders consume stock. Own-cups orders never
      // touched the product's `sizes[].stock`, so there's nothing to restore.
      if (
        newStatus === "Cancelled" &&
        order.status !== "Cancelled" &&
        !order.isProvided
      ) {
        const items = Array.isArray(order.items) ? order.items : [];

        for (const item of items) {
          if (!item.productId || !item.size || !item.quantity) continue;

          try {
            // ✅ Atomic increment — no read-modify-write race
            const updatedProduct = await Product.findOneAndUpdate(
              { id: item.productId, "sizes.name": item.size },
              {
                $inc: { "sizes.$.stock": item.quantity },
                $set: { updatedAt: new Date() },
              },
              { new: true },
            );

            if (updatedProduct) {
              const restored = updatedProduct.sizes.find(
                (s) => s.name === item.size,
              );
            } else {
              console.warn(
                `⚠️ Cannot restore — product ${item.productId} / size ${item.size} not found`,
              );
            }
          } catch (err) {
            console.error(
              `❌ Stock restore failed for ${item.productId} (${item.size}):`,
              err.message,
            );
          }
        }
      }

      order.status = newStatus;

      function generateNotes(status) {
        const receivingMode = order?.receivingMode || order?.deliveryMethod || 'Delivery';
        const isPickup = receivingMode === 'Pick-up';

        switch (status) {
          case "Scheduled":
            const scheduleDate = order?.productionSchedule
              ? new Date(order.productionSchedule).toLocaleDateString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Date not set';
            return `Order scheduled for production on ${scheduleDate}`;

          case "In Production":
            return "Order is now in production";

          case "Out for Delivery":
            if (isPickup) {
              return `Order is ready for pickup at the store`;
            }
            const driverName = order?.driverDetails?.driverName || 'Not assigned';
            const driverPhone = order?.driverDetails?.driverPhone || 'No phone';
            return `Order is out for delivery (Driver: ${driverName}, Phone: ${driverPhone})`;
            
          case "Completed":
            if (isPickup) {
              return "Order has been picked up by customer";
            }
            return "Order has been delivered and received";

          case "Cancelled":
            return "Order has been cancelled";

          default:
            return "";
        }
      }

      const historyEntry = {
        status: newStatus,
        timestamp: new Date(),
        notes: generateNotes(newStatus),
        updatedBy: user ? (user.firstName ? `${user.firstName} ${user.lastName}` : user.email || user._id.toString()) : null,
      };
      if (productionSchedule) historyEntry.productionSchedule = productionSchedule;
      if (order.driverDetails && order.receivingMode === "Delivery") {
        historyEntry.driverDetails = {
          driverName: order.driverDetails.driverName,
          driverPhone: order.driverDetails.driverPhone,
          plateNumber: order.driverDetails.plateNumber,
          truckDescription: order.driverDetails.truckDescription,
        };
      }

      order.statusHistory.push(historyEntry);
      order.updatedAt = new Date();
      if (user) order.updatedBy = user.firstName ? `${user.firstName} ${user.lastName}` : user.email || user._id.toString();

      await order.save();

      // ✅ Realtime
      emitOrderChanged(order, 'status');
      if (newStatus === 'Cancelled') {
        emitInventoryChanged({ reason: 'order-cancelled', orderId: order.orderId });
      }

      return {
        success: true,
        message: `Order status updated from ${oldStatus} to ${newStatus}`,
        data: order,
      };
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // NEGOTIATE ORDER (admin ↔ customer)
  //
  // Allowed ONLY when status === 'Pending' and paymentStatus === 'Unpaid'.
  //
  // Editable fields:
  //   - quantity      → restores old qty to stock, deducts new qty
  //   - unitPrice     → manual override (bypasses bulk tier)
  //   - designFee     → admin can adjust the design fee
  //   - deliveryMethod → 'Pick-up' | 'Delivery'
  //   - shippingFee   → admin can adjust
  //
  // Quantity is the top-level order quantity (matches items[0].quantity).
  // Unit price override applies to the first item (bulk orders use one size).
  // ─────────────────────────────────────────
  async negotiateOrder(orderId, updates, admin) {
    try {
      let order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: "Order not found" };
      }

      // ─── Guards: only Pending + Unpaid orders can be negotiated ────────
      if (order.status !== "Pending") {
        return {
          success: false,
          message: `Cannot negotiate an order with status "${order.status}". Only Pending orders can be negotiated.`,
        };
      }
      if (order.paymentStatus !== "Unpaid") {
        return {
          success: false,
          message: `Cannot negotiate an order with payment status "${order.paymentStatus}". Order is locked.`,
        };
      }

      const adminName = admin
        ? admin.firstName
          ? `${admin.firstName} ${admin.lastName}`
          : admin.email || admin._id?.toString() || "Admin"
        : "Admin";
      const adminId = admin?._id?.toString() || admin?.adminId || "";

      const historyEntries = [];
      const oldSnapshot = {
        quantity: order.quantity,
        unitPrice: order.items?.[0]?.estimatedTotal && order.items?.[0]?.quantity
          ? order.items[0].estimatedTotal / order.items[0].quantity
          : null,
        designFee: order.designFee,
        deliveryMethod: order.receivingMode,
        shippingFee: order.shippingFee,
        amount: order.amount,
      };

      // ─── Multi-item edits (cart orders) ────────────────────────────────
      // The panel sends `items: [{ productId, size, quantity, unitPrice }]`.
      // We reconcile each entry against the existing item at the same index.
      // Stock deltas are applied per item.
      if (Array.isArray(updates.items) && updates.items.length > 0) {
        if (order.isProvided) {
          return { success: false, message: 'Multi-item pricing is not supported for own-cups orders' };
        }
        if (updates.items.length !== order.items.length) {
          return { success: false, message: 'Item count mismatch — cannot add or remove items from the negotiation panel' };
        }

        for (let i = 0; i < updates.items.length; i++) {
          const patch = updates.items[i];
          const item = order.items[i];

          const newQty = Number(patch.quantity);
          const newUnit = Number(patch.unitPrice);
          if (!Number.isFinite(newQty) || newQty <= 0) {
            return { success: false, message: `Item ${i + 1}: quantity must be > 0` };
          }
          if (!Number.isFinite(newUnit) || newUnit < 0) {
            return { success: false, message: `Item ${i + 1}: unit price must be ≥ 0` };
          }

          // Stock delta (company products only)
          if (item.productId) {
            const product = await Product.findOne({ id: item.productId });
            if (!product) {
              return { success: false, message: `Product not found: ${item.productId}` };
            }
            const sizeObj = product.sizes.find((s) => s.name === item.size);
            if (!sizeObj) {
              return { success: false, message: `Size "${item.size}" not found for ${product.name}` };
            }

            const oldQty = Number(item.quantity) || 0;
            const diff = newQty - oldQty;

            if (diff > 0 && sizeObj.stock < diff) {
              return {
                success: false,
                message: `Insufficient stock for ${product.name} - ${item.size}. Available: ${sizeObj.stock}`,
              };
            }
            sizeObj.stock -= diff;              // handles add + remove
            await product.save();
          }

          const oldUnit = item.quantity > 0
            ? Number((item.estimatedTotal / item.quantity).toFixed(2))
            : 0;

          item.quantity = newQty;
          item.estimatedTotal = Number((newUnit * newQty).toFixed(2));

          if (oldUnit !== newUnit || newQty !== Number(patch.quantity)) {
            historyEntries.push({
              field: `items[${i}]`,
              oldValue: { qty: Number(patch.quantity), unit: oldUnit },
              newValue: { qty: newQty, unit: newUnit },
              updatedBy: adminName,
              updatedById: adminId,
              notes: updates.notes || '',
            });
          }
        }
      }

      // ─── Quantity (with stock delta) ────────────────────────────────────
      if (updates.quantity !== undefined && updates.quantity !== null) {
        const newQty = Number(updates.quantity);
        if (isNaN(newQty) || newQty <= 0) {
          return { success: false, message: "Quantity must be a positive number" };
        }
        if (newQty !== order.quantity) {
          const oldQty = order.quantity;

          if (!order.isProvided) {
            const firstItem = order.items?.[0];
            if (firstItem && firstItem.productId) {
              const product = await Product.findOne({ id: firstItem.productId });
              if (!product) {
                return { success: false, message: `Product not found: ${firstItem.productId}` };
              }
              const sizeObj = product.sizes.find((s) => s.name === firstItem.size);
              if (!sizeObj) {
                return {
                  success: false,
                  message: `Size "${firstItem.size}" not found for product ${product.name}`,
                };
              }

              // Restore old qty first
              sizeObj.stock += oldQty;

              // Check availability for new qty
              if (sizeObj.stock < newQty) {
                // Rollback
                sizeObj.stock -= oldQty;
                return {
                  success: false,
                  message: `Insufficient stock for ${product.name} - ${firstItem.size}. Available: ${sizeObj.stock}`,
                };
              }

              // Deduct new qty
              sizeObj.stock -= newQty;
              await product.save();
            }
          }

          order.quantity = newQty;
          if (order.items?.[0]) {
            order.items[0].quantity = newQty;

            // ── If the admin did NOT explicitly override unitPrice in this
            // same request, keep the effective per-unit price constant and
            // recalculate the item subtotal. Without this, a quantity-only
            // change (e.g. 500 → 1000) would leave estimatedTotal stale.
            const hasUnitPriceOverride =
              updates.unitPrice !== undefined &&
              updates.unitPrice !== null &&
              updates.unitPrice !== '';

            if (!hasUnitPriceOverride && oldQty > 0) {
              const existingUnitPrice =
                (order.items[0].estimatedTotal || 0) / oldQty;
              order.items[0].estimatedTotal =
                Number((existingUnitPrice * newQty).toFixed(2));
            }
          }

          historyEntries.push({
            field: "quantity",
            oldValue: oldQty,
            newValue: newQty,
            updatedBy: adminName,
            updatedById: adminId,
            notes: updates.notes || "",
          });
        }
      }

      // ─── Unit Price Override ────────────────────────────────────────────
      // Only applies to company-product orders with items[]
      if (
        updates.unitPrice !== undefined &&
        updates.unitPrice !== null &&
        updates.unitPrice !== "" &&
        !order.isProvided &&
        order.items?.[0]?.productId
      ) {
        const newUnitPrice = Number(updates.unitPrice);
        if (isNaN(newUnitPrice) || newUnitPrice < 0) {
          return { success: false, message: "Invalid unit price" };
        }

        const firstItem = order.items[0];
        const currentUnitPrice =
          firstItem.estimatedTotal && firstItem.quantity
            ? firstItem.estimatedTotal / firstItem.quantity
            : 0;

        if (newUnitPrice !== currentUnitPrice) {
          firstItem.estimatedTotal = newUnitPrice * firstItem.quantity;

          historyEntries.push({
            field: "unitPrice",
            oldValue: Number(currentUnitPrice.toFixed(2)),
            newValue: newUnitPrice,
            updatedBy: adminName,
            updatedById: adminId,
            notes: updates.notes || "",
          });
        }
      }

      // ─── Design Fee ─────────────────────────────────────────────────────
      if (updates.designFee !== undefined && updates.designFee !== null) {
        const newDesignFee = Number(updates.designFee);
        if (isNaN(newDesignFee) || newDesignFee < 0) {
          return { success: false, message: "Invalid design fee" };
        }
        if (newDesignFee !== order.designFee) {
          historyEntries.push({
            field: "designFee",
            oldValue: order.designFee,
            newValue: newDesignFee,
            updatedBy: adminName,
            updatedById: adminId,
            notes: updates.notes || "",
          });
          order.designFee = newDesignFee;
        }
      }

      // ─── Delivery Method ────────────────────────────────────────────────
      if (updates.deliveryMethod !== undefined && updates.deliveryMethod !== null) {
        const validMethods = ["Pick-up", "Delivery"];
        if (!validMethods.includes(updates.deliveryMethod)) {
          return { success: false, message: "Invalid delivery method" };
        }
        if (updates.deliveryMethod !== order.receivingMode) {
          historyEntries.push({
            field: "deliveryMethod",
            oldValue: order.receivingMode,
            newValue: updates.deliveryMethod,
            updatedBy: adminName,
            updatedById: adminId,
            notes: updates.notes || "",
          });
          order.receivingMode = updates.deliveryMethod;
          order.deliveryMethod = updates.deliveryMethod;
        }
      }

      // ─── Shipping Fee ───────────────────────────────────────────────────
      if (updates.shippingFee !== undefined && updates.shippingFee !== null) {
        const newShipping = Number(updates.shippingFee);
        if (isNaN(newShipping) || newShipping < 0) {
          return { success: false, message: "Invalid shipping fee" };
        }
        if (newShipping !== order.shippingFee) {
          historyEntries.push({
            field: "shippingFee",
            oldValue: order.shippingFee,
            newValue: newShipping,
            updatedBy: adminName,
            updatedById: adminId,
            notes: updates.notes || "",
          });
          order.shippingFee = newShipping;
        }
      } else if (updates.deliveryMethod === "Pick-up" && order.shippingFee !== 0) {
        historyEntries.push({
          field: "shippingFee",
          oldValue: order.shippingFee,
          newValue: 0,
          updatedBy: adminName,
          updatedById: adminId,
          notes: "Auto-zeroed for Pick-up",
        });
        order.shippingFee = 0;
      }

      // ─── Recompute totals ───────────────────────────────────────────────
      let productSubtotal = 0;
      if (!order.isProvided && order.items?.length) {
        productSubtotal = order.items.reduce(
          (sum, it) => sum + (it.estimatedTotal || 0),
          0,
        );
      }

      const designFee = order.designFee || 0;
      const shippingFee = order.shippingFee || 0;
      const newAmount = productSubtotal + designFee + shippingFee;

      if (newAmount !== order.amount) {
        historyEntries.push({
          field: "amount",
          oldValue: order.amount,
          newValue: newAmount,
          updatedBy: adminName,
          updatedById: adminId,
          notes: "Recalculated after negotiation",
        });
        order.amount = newAmount;
        order.totalAmount = newAmount;
      }

      // ─── Persist + history ──────────────────────────────────────────────
      if (historyEntries.length > 0) {
        order.negotiationStatus = "in_progress";
        order.pricingHistory.push(...historyEntries);
        order.updatedAt = new Date();
        order.updatedBy = adminName;
        
        await order.save();

        await order.save();
      }

      // Include computed subtotal for frontend convenience
      const responseData = order.toObject();
      responseData.productSubtotal = productSubtotal;

      return {
        success: true,
        message:
          historyEntries.length > 0
            ? `Order updated with ${historyEntries.length} change(s)`
            : "No changes to apply",
        data: responseData,
        changes: historyEntries,
        oldSnapshot,
      };
    } catch (error) {
      console.error("Error in negotiateOrder:", error);
      throw error;
    }
  }

    async confirmWithDownpayment(orderId, payload, admin) {
    try {
      const {
        amountPaid,
        method,
        referenceNumber,
        proofUrl,
        isFullPayment = false,
        paymentRequestMessageId = null,
      } = payload || {};

      const order = await Order.findOne({ orderId });
      if (!order) return { success: false, message: 'Order not found' };

      // ✅ Snapshot the paid amount before recording the downpayment
      const paidBefore = this._computeTotalPaid(order);

      // Guards
      if (order.status !== 'Pending') {
        return { success: false, message: `Cannot confirm — order status is "${order.status}"` };
      }
      if (order.paymentStatus !== 'Unpaid') {
        return { success: false, message: `Payment already recorded (${order.paymentStatus})` };
      }

      const amount = Number(amountPaid);
      if (!amount || amount <= 0) {
        return { success: false, message: 'amountPaid must be greater than 0' };
      }

      const total = order.amount || order.totalAmount || 0;
      if (amount > total) {
        return { success: false, message: `amountPaid (₱${amount}) exceeds order total (₱${total})` };
      }

      const adminName = admin?.firstName
        ? `${admin.firstName} ${admin.lastName}`
        : admin?.email || 'Admin';

      // Record the payment
      order.partialPayments = order.partialPayments || [];
      order.partialPayments.push({
        amount,
        referenceNumber: referenceNumber || '',
        date: new Date(),
        updatedBy: adminName,
      });

      // Determine new payment status
      const totalPaid = order.partialPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const fullyPaid = isFullPayment || totalPaid >= total;
      order.paymentStatus = fullyPaid ? 'Paid' : 'Partial';

      // Confirm the order
      order.status = 'Confirmed';
      order.negotiationStatus = 'finalized';
      order.updatedAt = new Date();
      order.updatedBy = adminName;

      order.statusHistory.push({
        status: 'Confirmed',
        timestamp: new Date(),
        notes: `${fullyPaid ? 'Full payment' : 'Downpayment'} verified — ₱${amount.toLocaleString()} via ${method || 'N/A'}${referenceNumber ? ` (ref: ${referenceNumber})` : ''}`,
        updatedBy: adminName,
      });

      // Clear active payment request
      order.activePaymentRequestMessageId = null;

      await order.save();

      // ✅ Realtime
      emitOrderChanged(order, 'confirmed');

      // Mark linked payment-request message as verified
      if (paymentRequestMessageId) {
        await Message.updateOne(
          { messageId: paymentRequestMessageId },
          {
            $set: {
              'paymentRequestData.status': 'verified',
              'paymentRequestData.statusUpdatedAt': new Date(),
              'paymentRequestData.statusUpdatedBy': adminName,
            },
          }
        );
      }

      // ✅ Apply the totalSpent delta
      const paidAfter = this._computeTotalPaid(order);
      const delta = paidAfter - paidBefore;
      if (delta !== 0) {
        await this._applyTotalSpentDelta(order, delta);
      }

      return {
        success: true,
        message: fullyPaid ? 'Order confirmed — full payment recorded' : 'Order confirmed — downpayment recorded',
        data: order,
      };
    } catch (error) {
      console.error('Error in confirmWithDownpayment:', error);
      throw error;
    }
  }

    // ─────────────────────────────────────────
  // ✅ NEW — Update drop-off status only.
  //
  // Drop-off tracking is orthogonal to order status: an own-cups order
  // sits at "Pending" while the customer brings their items in, and
  // the admin flagging receipt of those items must NOT advance the
  // status flow. This method touches nothing but `dropOffStatus`.
  // ─────────────────────────────────────────
  async updateDropOffStatus(orderId, dropOffStatus, user = null) {
    try {
      const VALID = ['Pending', 'Received']
      if (!VALID.includes(dropOffStatus)) {
        return { success: false, message: `Invalid dropOffStatus: ${dropOffStatus}` }
      }

      const order = await Order.findOne({ orderId })
      if (!order) {
        return { success: false, message: 'Order not found' }
      }

      // Only own-cups orders use drop-off tracking.
      if (!order.isProvided) {
        return {
          success: false,
          message: 'Drop-off tracking only applies to own-cups orders',
        }
      }

      const adminName = user
        ? user.firstName
          ? `${user.firstName} ${user.lastName}`
          : user.email || 'Admin'
        : 'Admin'

      const oldStatus = order.dropOffStatus
      if (oldStatus === dropOffStatus) {
        return { success: true, data: order, message: 'No change' }
      }

      order.dropOffStatus = dropOffStatus
      order.updatedAt = new Date()
      order.updatedBy = adminName

      // Append a history entry so the timeline reflects the drop-off.
      // NOTE: `status` is left as the current order status — we are not
      // advancing the flow, just logging the event.
      order.statusHistory.push({
        status: order.status,
        timestamp: new Date(),
        notes:
          dropOffStatus === 'Received'
            ? 'Customer dropped off their items.'
            : 'Drop-off status reset to Pending.',
        updatedBy: adminName,
      })

      await order.save()

      // ✅ Realtime
      emitOrderChanged(order, 'dropoff')

      return {
        success: true,
        message: `Drop-off status updated to ${dropOffStatus}`,
        data: order,
      }
    } catch (error) {
      console.error('Error in updateDropOffStatus:', error)
      throw error
    }
  }

  async reportDelay(orderId, payload, reporter, reporterType = 'admin') {
    try {
      const { category, reason, notes, newExpectedDelivery } = payload || {};

      if (!reason || !String(reason).trim()) {
        return { success: false, message: 'A delay reason is required' };
      }

      // ── Accept EITHER the human-readable orderId (ORD-2026-…) OR the
      //    MongoDB _id. Driver endpoints send the mongo _id; admin
      //    endpoints send the human-readable one.
      const orderQuery = mongoose.isValidObjectId(orderId)
        ? { $or: [{ orderId }, { _id: orderId }] }
        : { orderId };

      const order = await Order.findOne(orderQuery);
      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      if (['Completed', 'Cancelled'].includes(order.status)) {
        return {
          success: false,
          message: `Cannot mark a ${order.status.toLowerCase()} order as delayed`,
        };
      }

      // ── Driver-specific guard rails ──────────────────────────────
      if (reporterType === 'driver') {
        // 1. Driver must own this order
        if (order.driverDetails?.driverId !== reporter?.driverId) {
          return { success: false, message: 'You are not assigned to this order' };
        }
        // 2. Driver can only report delays during Out for Delivery
        if (order.status !== 'Out for Delivery') {
          return {
            success: false,
            message: 'You can only report delays while the order is Out for Delivery',
          };
        }
        // 3. Driver can only use logistics categories
        const DRIVER_CATEGORIES = [
          'logistics',
          'weather',
          'vehicle_breakdown',
          'customer_unavailable',
          'other',
        ];
        if (!DRIVER_CATEGORIES.includes(category)) {
          return {
            success: false,
            message: `Drivers cannot use category "${category}"`,
          };
        }
      }

      const reporterName = reporter?.firstName
        ? `${reporter.firstName} ${reporter.lastName || ''}`.trim()
        : reporter?.email || (reporterType === 'driver' ? 'Driver' : 'Admin');
      const reporterId =
        reporter?._id?.toString() ||
        reporter?.adminId ||
        reporter?.driverId ||
        'UNKNOWN';

      // Prefix the reason so the customer knows it came from the road
      const enrichedReason =
        reporterType === 'driver'
          ? `${String(reason).trim()} (reported by driver ${reporterName})`
          : String(reason).trim();

      // Preserve the ORIGINAL ETA across multiple delay events
      const existingOriginal = order.delayHistory?.find(
        (d) => d.originalExpectedDelivery,
      )?.originalExpectedDelivery;
      const originalETA = existingOriginal || order.expectedDelivery || null;

      // Resolve any currently-active delay before starting a new one
      (order.delayHistory || []).forEach((d) => {
        if (d.isDelayed) {
          d.isDelayed = false;
          d.resolvedAt = new Date();
          d.resolvedBy = reporterName;
        }
      });
      // Append the new delay event
      order.delayHistory.push({
        isDelayed: true,
        category: category || 'other',
        reason: enrichedReason,
        notes: notes || '',
        originalExpectedDelivery: originalETA,
        newExpectedDelivery: newExpectedDelivery
          ? new Date(newExpectedDelivery)
          : null,
        reportedBy: reporterName,
        reportedByType: reporterType,
        reportedAt: new Date(),
      });

      // Reflect the new ETA on the order itself so receipts /
      // dashboards always show reality.
      if (newExpectedDelivery) {
        order.expectedDelivery = new Date(newExpectedDelivery);
      }

      // Audit trail (same shape as statusHistory entries)
      order.statusHistory.push({
        status: order.status,
        timestamp: new Date(),
        notes: `Order delayed — ${enrichedReason}`,
        updatedBy: reporterName,
      });

      order.updatedAt = new Date();
      order.updatedBy = reporterName;
      await order.save();

      // ✅ Realtime
      emitOrderChanged(order, 'delayed');

      // ── Push a system message to the linked conversation ────────────
      await this._pushDelayNoticeToChat(order, reporterName, reporterId);

      return {
        success: true,
        message: 'Delay reported and customer notified',
        data: order,
      };
    } catch (error) {
      console.error('Error in reportDelay:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // RESOLVE DELAY — clear the active delay flag
  // ─────────────────────────────────────────
  async resolveDelay(orderId, admin) {
    try {
      const mongoose = require('mongoose');

      // Accept EITHER the human-readable orderId (e.g. ORD-2026-0421)
      // OR the MongoDB _id — the driver frontend sends the mongo _id.
      const orderQuery = mongoose.isValidObjectId(orderId)
        ? { $or: [{ orderId }, { _id: orderId }] }
        : { orderId };

      const order = await Order.findOne(orderQuery);
      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      const hasActive = (order.delayHistory || []).some((d) => d.isDelayed);
      if (!hasActive) {
        return { success: false, message: 'Order is not currently delayed' };
      }

      const adminName = admin?.firstName
        ? `${admin.firstName} ${admin.lastName}`
        : admin?.email || 'Admin';

      order.delayHistory.forEach((d) => {
        if (d.isDelayed) {
          d.isDelayed = false;
          d.resolvedAt = new Date();
          d.resolvedBy = adminName;
        }
      });

      order.statusHistory.push({
        status: order.status,
        timestamp: new Date(),
        notes: 'Delay resolved — order back on track',
        updatedBy: adminName,
      });

      order.updatedAt = new Date();
      order.updatedBy = adminName;
      await order.save();

      // ✅ Realtime
      emitOrderChanged(order, 'delay-resolved');

      return {
        success: true,
        message: 'Delay resolved',
        data: order,
      };
    } catch (error) {
      console.error('Error in resolveDelay:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // HELPER: push a delay-notice system message
  // ─────────────────────────────────────────
  async _pushDelayNoticeToChat(order, adminName, adminId) {
    try {
      const Conversation = require('../models/Conversation.Model');
      const Message = require('../models/Message.Model');
      const generateId = require('../utils/generateId');

      const conversation = await Conversation.findOne({ orderId: order.orderId });
      if (!conversation) return;

      const lastDelay = order.delayHistory[order.delayHistory.length - 1];

      const notice = new Message({
        messageId: await generateId('MSG'),
        conversationId: conversation.conversationId,
        senderType: 'admin',
        senderId: adminId,
        senderName: adminName,
        content: `⚠️ Order ${order.orderId} delayed — ${lastDelay.reason}`,
        contentType: 'delay-notice',
        delayNoticeData: {
          orderId: order.orderId,
          category: lastDelay.category,
          reason: lastDelay.reason,
          originalExpectedDelivery: lastDelay.originalExpectedDelivery,
          newExpectedDelivery: lastDelay.newExpectedDelivery,
          reportedAt: lastDelay.reportedAt,
        },
        isDeleted: false,
        createdAt: new Date(),
      });
      await notice.save();

      conversation.lastMessage = `⚠️ Delay notice: ${lastDelay.reason}`;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageBy = 'admin';
      conversation.customerUnreadCount += 1;
      conversation.adminUnreadCount = 0;
      await conversation.save();

      // Broadcast via socket if available
      try {
        const io = global.__io__;
        if (io) {
          io.to(`conv_${conversation.conversationId}`).emit('new-message', notice.toObject());
        }
      } catch (e) {
        // Non-fatal
      }

    } catch (err) {
      // Never break the delay flow over a chat failure
      console.error('_pushDelayNoticeToChat failed:', err);
    }
  }


  // ─────────────────────────────────────────
  // UPDATE ORDER
  // ─────────────────────────────────────────
  async updateOrder(orderId, payload, user = null) {
    try {
      const { orderId: _id, orderedAt, orderedBy, ...updateData } = payload;
      delete updateData.orderId;
      delete updateData.orderedAt;

      let order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: "Order not found" };
      }

      if (updateData.quantity && !order.isProvided) {
        const quantityDiff = updateData.quantity - order.quantity;
        const product = await Product.findOne({ id: order.productId });

        if (product && quantityDiff !== 0) {
          const inventory = await InventoryItem.findOne({
            product: product._id,
            sizeLabel: { $regex: new RegExp(`^${order.size}$`, "i") },
          });

          if (inventory) {
            if (quantityDiff > 0 && inventory.stock < quantityDiff) {
              return { success: false, message: `Insufficient stock to increase quantity by ${quantityDiff}` };
            }
            inventory.stock -= quantityDiff;
            await inventory.save();
          }
        }
      }

      updateData.updatedAt = new Date();
      if (user) updateData.updatedBy = user.firstName ? `${user.firstName} ${user.lastName}` : user.email || user._id.toString();

      const updatedOrder = await Order.findOneAndUpdate({ orderId }, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedOrder) {
        return { success: false, message: "Order not found" };
      }

      return { success: true, message: "Order updated successfully", data: updatedOrder };
    } catch (error) {
      console.error("Error updating order:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // DELETE ORDER
  // ─────────────────────────────────────────
  async deleteOrder(orderId) {
    try {
      const order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: "Order not found" };
      }

      if (!order.isProvided && order.status !== "Completed" && order.status !== "Cancelled") {
        const product = await Product.findOne({ id: order.productId });
        if (product) {
          const inventory = await InventoryItem.findOne({
            product: product._id,
            sizeLabel: { $regex: new RegExp(`^${order.size}$`, "i") },
          });
          if (inventory) {
            inventory.stock += order.quantity;
            await inventory.save();
          }
        }
      }

      if (order.driverDetails?.driverId) {
        await DriverService.decrementAssignedOrders(order.driverDetails.driverId);
      }

      if (order.orderedBy) {
        const customer = await Customer.findOne({ _id: order.orderedBy });
        if (customer) {
          await Customer.findByIdAndUpdate(customer._id, {
            $pull: { orders: order._id }
          });
        }
      }
            // ✅ NEW — Clean up the customer's item photos from Cloudinary.
      try {
        const { deleteImage } = require('../config/multer');

        const itemPhotoPublicIds = [
          ...(Array.isArray(order.itemPhotos) ? order.itemPhotos : []),
        ];

        // Also pull public IDs from items[] if stored per-item
        if (Array.isArray(order.items)) {
          for (const it of order.items) {
            if (Array.isArray(it.itemPhotoPublicIds)) {
              itemPhotoPublicIds.push(...it.itemPhotoPublicIds);
            }
          }
        }

        // If we don't have public IDs, derive them from the URLs
        const idsToDelete = itemPhotoPublicIds
          .filter(Boolean)
          .map((id) =>
            typeof id === 'string' && id.includes('cloudinary.com')
              ? (id.match(/\/v\d+\/([^.]+)/)?.[1] || null)
              : id,
          )
          .filter(Boolean);

        for (const publicId of idsToDelete) {
          await deleteImage(publicId);
        }
      } catch (err) {
        // Non-fatal — never block order deletion on a Cloudinary failure
        console.error('Failed to clean up item photos on order delete:', err);
      }

      await Order.findOneAndDelete({ orderId });

      // ✅ Realtime — broadcast the deletion to admins
      if (global.__io__) {
        global.__io__.to('admins').emit('order:changed', {
          orderId,
          action: 'deleted',
          timestamp: new Date().toISOString(),
        });
      }
      emitInventoryChanged({ reason: 'order-deleted', orderId });

      return { success: true, message: "Order deleted successfully", data: { orderId, status: order.status } };
    } catch (error) {
      console.error("Error deleting order:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ALL ORDERS
  // ─────────────────────────────────────────
  async getAllOrders(filters = {}) {
    try {
      const query = {};
      if (filters.status) query.status = normalizeIncomingStatus(filters.status);
      if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
      if (filters.receivingMode) query.receivingMode = filters.receivingMode;
      if (filters.customerEmail) query.customerEmail = filters.customerEmail;
      if (filters.productId) query.productId = filters.productId;
      if (filters.orderedBy) query.orderedBy = filters.orderedBy;
      if (filters.isProvided !== undefined) query.isProvided = filters.isProvided === "true";

      if (filters.startDate) {
        query.orderedAt = { $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        query.orderedAt = { ...query.orderedAt, $lte: new Date(filters.endDate) };
      }

      const orders = await Order.find(query).sort({ orderedAt: -1 });
      return { success: true, data: orders, count: orders.length };
    } catch (error) {
      console.error("Error fetching orders:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ORDER BY ID
  // ─────────────────────────────────────────
  async getOrderById(orderId) {
    try {
      const order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: "Order not found" };
      }

      let productDetails = null;
      if (order.productId && !order.isProvided) {
        productDetails = await Product.findOne({ id: order.productId });
      }

      return { success: true, data: { ...order.toObject(), productDetails } };
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ORDERS BY ORDERED BY
  // ─────────────────────────────────────────
  async getOrdersByOrderedBy(orderedById) {
    try {
      const orders = await Order.find({ orderedBy: orderedById }).sort({ orderedAt: -1 });
      return { success: true, data: orders, count: orders.length };
    } catch (error) {
      console.error("Error fetching orders by orderedBy:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ORDERS BY CUSTOMER EMAIL
  // ─────────────────────────────────────────
  async getOrdersByCustomerEmail(customerEmail) {
    try {
      const orders = await Order.find({ customerEmail }).sort({ orderedAt: -1 });
      if (orders.length === 0) {
        return { success: false, message: "No orders found for this customer" };
      }
      return { success: true, data: orders, count: orders.length };
    } catch (error) {
      console.error("Error fetching customer orders:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // UPDATE PAYMENT STATUS
  // ─────────────────────────────────────────
  async updatePaymentStatus(orderId, paymentStatus, amountPaid = null, user = null, partialPayments = null) {
    try {
      const validStatuses = ["Paid", "Partial", "Unpaid"];
      if (!validStatuses.includes(paymentStatus)) {
        return { success: false, message: "Invalid payment status" };
      }

      const order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: "Order not found" };
      }

      // ✅ Snapshot the total paid BEFORE we touch partialPayments.
      // After all branches run, we'll compute the delta and apply it
      // to the customer's totalSpent.
      const paidBefore = this._computeTotalPaid(order);

      if (partialPayments !== null && Array.isArray(partialPayments)) {
        order.partialPayments = partialPayments;
        const totalPaid = partialPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const totalAmount = order.amount || order.totalAmount || 0;
        if (totalPaid >= totalAmount && totalAmount > 0) {
          paymentStatus = 'Paid';
        } else if (totalPaid > 0) {
          paymentStatus = 'Partial';
        } else {
          paymentStatus = 'Unpaid';
        }
      } else {
        // ─── Partial payment: validate then record ─────────────────────
        if (paymentStatus === "Partial") {
          if (amountPaid === null || amountPaid === undefined) {
            return { success: false, message: "amountPaid is required when marking payment as Partial" };
          }
          if (Number(amountPaid) <= 0) {
            return { success: false, message: "amountPaid must be greater than 0" };
          }
          if (Number(amountPaid) >= Number(order.amount)) {
            return {
              success: false,
              message: "amountPaid must be less than the order total for a Partial payment. Use 'Paid' instead.",
            };
          }

          order.partialPayments = order.partialPayments || [];
          order.partialPayments.push({
            amount: Number(amountPaid),
            referenceNumber: null,
            date: new Date(),
            updatedBy: user ? user._id?.toString() || user.email || "Admin" : "Admin",
          });
        }

        // ✅ FIX #1a — Paid: record ANY remaining balance
        // This fires when the driver/admin marks Completed with COD
        // collected, or when an admin manually flips to Paid. Guarantees
        // the ledger is complete (downpayment + final settlement).
        if (paymentStatus === "Paid") {
          const totalAmount = Number(order.amount) || Number(order.totalAmount) || 0;
          const alreadyPaid = Array.isArray(order.partialPayments)
            ? order.partialPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
            : 0;
          const remainingBalance = Math.max(0, totalAmount - alreadyPaid);

          if (remainingBalance > 0) {
            order.partialPayments = order.partialPayments || [];
            order.partialPayments.push({
              amount: remainingBalance,
              referenceNumber: null,
              date: new Date(),
              updatedBy: user
                ? user.firstName
                  ? `${user.firstName} ${user.lastName}`
                  : user.email || user._id?.toString() || "System"
                : "System (auto-recorded on Paid)",
            });
          }
        }
      }

      const oldPaymentStatus = order.paymentStatus;
      order.paymentStatus = paymentStatus;

      if (paymentStatus === "Paid") {
        order.paymentDetails = order.paymentDetails || {};
        order.paymentDetails.paidAt = new Date();
      }

      order.updatedAt = new Date();
      if (user) order.updatedBy = user._id?.toString() || user.email || 'Admin';

      await order.save();

      // ✅ Realtime
      emitOrderChanged(order, 'payment');

      // ✅ Apply the totalSpent delta based on how much was paid before
      // vs. after this update. Works for all cases: incremental payments,
      // full payment transitions, and manual array replacements.
      const paidAfter = this._computeTotalPaid(order);
      const delta = paidAfter - paidBefore;

      if (delta !== 0) {
        await this._applyTotalSpentDelta(order, delta);
      }

      return {
        success: true,
        message: `Payment status updated from ${oldPaymentStatus} to ${paymentStatus}`,
        data: order,
      };
    } catch (error) {
      console.error("Error updating payment status:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ORDER STATISTICS
  // ─────────────────────────────────────────
  async getOrderStatistics() {
    try {
      const totalOrders = await Order.countDocuments();
      const pendingOrders = await Order.countDocuments({ status: "Pending" });
      const scheduledOrders = await Order.countDocuments({ status: "Scheduled" });
      const inProductionOrders = await Order.countDocuments({ status: "In Production" });
      const outForDeliveryOrders = await Order.countDocuments({ status: "Out for Delivery" });
      const completedOrders = await Order.countDocuments({ status: "Completed" });
      const cancelledOrders = await Order.countDocuments({ status: "Cancelled" });

      const totalRevenue = await Order.aggregate([
        { $match: { status: "Completed", paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const ownCupsOrders = await Order.countDocuments({ isProvided: true });
      const companyProductOrders = await Order.countDocuments({ isProvided: false });

      return {
        success: true,
        data: {
          totalOrders,
          pendingOrders,
          scheduledOrders,
          inProductionOrders,
          outForDeliveryOrders,
          completedOrders,
          cancelledOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          ownCupsOrders,
          companyProductOrders,
        },
      };
    } catch (error) {
      console.error("Error getting order statistics:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ORDERS BY DATE RANGE
  // ─────────────────────────────────────────
  async getOrdersByDateRange(startDate, endDate) {
    try {
      const orders = await Order.find({
        orderedAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      }).sort({ orderedAt: -1 });
      return { success: true, data: orders, count: orders.length };
    } catch (error) {
      console.error("Error fetching orders by date range:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ORDERS BY PRODUCT
  // ─────────────────────────────────────────
  async getOrdersByProduct(productId) {
    try {
      const orders = await Order.find({ productId, isProvided: false }).sort({ orderedAt: -1 });
      return { success: true, data: orders, count: orders.length };
    } catch (error) {
      console.error("Error fetching orders by product:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET RECENT ORDERS
  // ─────────────────────────────────────────
  async getRecentOrders(limit = 10) {
    try {
      const orders = await Order.find({}).sort({ orderedAt: -1 }).limit(limit);
      return { success: true, data: orders };
    } catch (error) {
      console.error("Error fetching recent orders:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // TOGGLE RECEIVED STATUS
  // ─────────────────────────────────────────
  async toggleReceivedStatus(orderId, isReceived, user = null) {
    try {
      const order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: "Order not found" };
      }

      // ✅ Snapshot the paid amount before the update
      const paidBefore = this._computeTotalPaid(order);

      if (order.status !== "Out for Delivery") {
        const friendlyStatus =
          order.status === "Out for Delivery" && order.receivingMode === "Pick-up"
            ? "Ready to Pick-up"
            : order.status;
        return {
          success: false,
          message: `Cannot mark as received. Current status: ${friendlyStatus}`,
        };
      }

      order.isReceived = isReceived;
      order.updatedAt = new Date();

      if (isReceived) {
        // ✅ FIX #1c — Record remaining balance BEFORE flipping to Paid
        const totalAmount = Number(order.amount) || Number(order.totalAmount) || 0;
        const alreadyPaid = Array.isArray(order.partialPayments)
          ? order.partialPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
          : 0;
        const remainingBalance = Math.max(0, totalAmount - alreadyPaid);

        if (remainingBalance > 0) {
          order.partialPayments = order.partialPayments || [];
          order.partialPayments.push({
            amount: remainingBalance,
            referenceNumber: null,
            date: new Date(),
            updatedBy: user
              ? user.firstName
                ? `${user.firstName} ${user.lastName}`
                : user.email || "Customer"
              : "Customer (marked received)",
          });
        }

        order.status = "Completed";
        order.paymentStatus = "Paid";
        order.paymentDetails = order.paymentDetails || {};
        order.paymentDetails.paidAt = new Date();

        order.statusHistory.push({
          status: "Completed",
          timestamp: new Date(),
          notes:
            order.receivingMode === "Pick-up"
              ? "Order marked as picked up by customer"
              : "Order marked as received by customer",
          updatedBy: user ? user._id?.toString() || user.email : null,
        });

        if (order.driverDetails?.driverId) {
          const decrementResult = await DriverService.decrementAssignedOrders(order.driverDetails.driverId);
          if (decrementResult.success) {
          }
        }
      }

      if (user) order.updatedBy = user._id?.toString() || user.email;

      await order.save();

      // ✅ Apply the totalSpent delta
      const paidAfter = this._computeTotalPaid(order);
      const delta = paidAfter - paidBefore;
      if (delta !== 0) {
        await this._applyTotalSpentDelta(order, delta);
      }

      return { success: true, data: order, message: "Order marked as received successfully" };
    } catch (error) {
      console.error("Error toggling received status:", error);
      throw error;
    }
  }
}

module.exports = new OrderService();