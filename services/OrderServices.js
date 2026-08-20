// services/OrderService.js
const mongoose = require("mongoose");
const Order = require("../models/Order.Model");
const InventoryItem = require("../models/InventoryItem.Model");
const Product = require("../models/Product.Model");
const Driver = require("../models/Driver.Model");
const DriverService = require("./DriverServices");
const Customer = require("../models/Customer.Model");
const generateId = require("../utils/generateItemId");

// ─── Constants ──────────────────────────────────────────────────────────────
const DESIGN_AND_PRINTING_FEE = 500;

// ─── Status constants ──────────────────────────────────────────────────────
const VALID_STATUSES = [
  "Pending",
  "Scheduled",
  "In Production",
  "Out for Delivery",
  "Completed",
  "Cancelled",
];

const STATUS_FLOW = ["Pending", "Scheduled", "In Production", "Out for Delivery", "Completed"];

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
 * ✅ Helper function to determine if an item has a design
 * Returns true if designSource is 'upload' or 'saved'
 * Returns false if designSource is 'no-design' or not provided
 */
function hasValidDesign(item) {
  if (!item) return false;
  
  // If designSource is explicitly 'no-design', return false
  if (item.designSource === 'no-design') {
    return false;
  }
  
  // If designSource is 'upload' or 'saved', return true
  if (item.designSource === 'upload' || item.designSource === 'saved') {
    return true;
  }
  
  // Check for files (uploaded design)
  if (item.files && item.files.length > 0) {
    return true;
  }
  
  // Check for design image
  if (item.designImage && item.designImage.length > 0) {
    return true;
  }
  
  // Check for selected template (saved design)
  if (item.selectedTemplateId || item.selectedTemplate) {
    return true;
  }
  
  // Check for design notes (could indicate custom design)
  if (item.designNotes && item.designNotes.trim().length > 0) {
    // But only if it's not the default "no design" note
    if (item.designNotes !== 'No design - plain product, as is.' && 
        item.designNotes !== 'No design - plain product as is') {
      return true;
    }
  }
  
  return false;
}

class OrderService {
  // ─────────────────────────────────────────
  // CREATE ORDER
  // ─────────────────────────────────────────
  async createOrder(payload, user = null, userType = null) {
    const session = await mongoose.startSession();
    try {
      console.log("\n=== 🔵 CREATE ORDER STARTED ===");
      console.log("Payload:", JSON.stringify(payload, null, 2));

      let orderedById;
      let customerEmail = payload.customerEmail;
      let customerName = payload.customerName;
      let customerPhone = payload.customerPhone;
      let customerId = null;

      // ─── Get or find customer ──────────────────────────────────────────
      if (user && userType === "customer") {
        orderedById = user._id.toString();
        customerEmail = customerEmail || user.email;
        customerName = customerName || user.name;
        customerPhone = customerPhone || user.phone;
        
        const customer = await Customer.findOne({ _id: user._id });
        if (customer) {
          customerId = customer._id;
          console.log(`✅ Found customer: ${customer.email} (ID: ${customerId})`);
        } else {
          console.warn(`⚠️ Customer not found for user ID: ${user._id}`);
        }
      } else if (customerEmail) {
        const customer = await Customer.findOne({ email: customerEmail });
        if (customer) {
          customerId = customer._id;
          orderedById = customer._id.toString();
          console.log(`✅ Found customer by email: ${customerEmail} (ID: ${customerId})`);
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

        // OWN CUPS: ₱500 flat fee (covers both printing service AND design if applicable)
        const totalAmount = DESIGN_AND_PRINTING_FEE;
        
        // ✅ Check if there's a valid design using the helper function
        const hasDesign = hasValidDesign(firstItem) || hasValidDesign(payload);

        // Build design details from first item or payload
        const designDetails = {
          designSource: firstItem.designSource || payload.designSource || "upload",
          designImage: firstItem.designImage || payload.designImage || "",
          printSize: firstItem.printSize || payload.printSize || "",
          printPlacement: firstItem.printPlacement || payload.printPlacement || "",
          designNotes: firstItem.designNotes || payload.designNotes || "",
          files: firstItem.files || payload.files || [],
        };

        console.log(`✅ Own cups order - hasDesign: ${hasDesign}`);

        newOrder = new Order({
          orderId: `${providedId}-PROV`,
          customerName,
          customerEmail,
          customerPhone,
          address: payload.address,
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
              estimatedTotal: 0,
            },
          ],
          designDetails: [designDetails],
          hasDesign: hasDesign, // ✅ Set hasDesign flag based on designSource
          quantity: firstItem.quantity || payload.quantity,
          amount: totalAmount,
          status: "Pending",
          paymentStatus: "Unpaid",
          receivingMode: payload.receivingMode,
          expectedDelivery,
          preferredDate: payload.preferredDate || null,
          fromCustomerToCompanyDeliveryDate: payload.fromCustomerToCompanyDeliveryDate || null,
          isProvided: true,
          orderedBy: orderedById,
          notes: payload.notes || "Customer provided items for printing",
          statusHistory: [
            {
              status: "Pending",
              timestamp: new Date(),
              notes: "Order created (customer provided items)",
              updatedBy: orderedById,
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
        });

        await newOrder.save();

        if (customerId) {
          await Customer.findByIdAndUpdate(customerId, {
            $push: { orders: newOrder._id }
          });
          console.log(`✅ Order ${newOrder.orderId} added to customer's orders array`);
        }

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

            let unitPrice = sizeObj.price;
            const qty = item.quantity;
            if (qty >= 5000 && sizeObj.bulkPrices?.[5000]) unitPrice = sizeObj.bulkPrices[5000] / 5000;
            else if (qty >= 2000 && sizeObj.bulkPrices?.[2000]) unitPrice = sizeObj.bulkPrices[2000] / 2000;
            else if (qty >= 1000 && sizeObj.bulkPrices?.[1000]) unitPrice = sizeObj.bulkPrices[1000] / 1000;
            else if (qty >= 500 && sizeObj.bulkPrices?.[500]) unitPrice = sizeObj.bulkPrices[500] / 500;

            const itemTotal = unitPrice * qty;
            productTotal += itemTotal;

            // ✅ Check if this item has a valid design using the helper function
            if (hasValidDesign(item)) {
              hasDesign = true;
            }

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
            });

            sizeObj.stock -= item.quantity;
            await product.save({ session });
          }

          // ✅ COMPANY PRODUCT: Add design fee (₱500) ONLY if there's a design
          let totalAmount = productTotal;
          if (hasDesign) {
            totalAmount += DESIGN_AND_PRINTING_FEE;
            console.log("✅ Design fee added to company product order");
          } else {
            console.log("❌ No design fee added - no design provided");
          }

          // ✅ Build design details from the first item
          const firstItem = processedItems[0] || {};
          const designDetails = {
            designSource: firstItem.designSource || "upload",
            designImage: firstItem.designImage || "",
            printSize: firstItem.printSize || "",
            printPlacement: firstItem.printPlacement || "",
            designNotes: firstItem.designNotes || "",
            files: firstItem.files || [],
          };

          console.log(`✅ Company order - hasDesign: ${hasDesign}`);

          const OrderId = await generateId("ORD");

          newOrder = new Order({
            orderId: `${OrderId}-COMP`,
            customerName,
            customerEmail,
            customerPhone,
            address: payload.address,
            postalCode: payload.postalCode || "",
            items: processedItems,
            hasDesign: hasDesign, // ✅ Set hasDesign flag based on designSource
            designDetails: [designDetails],
            quantity: processedItems.reduce((sum, i) => sum + i.quantity, 0),
            amount: totalAmount,
            status: "Pending",
            paymentStatus: "Unpaid",
            receivingMode: payload.receivingMode,
            expectedDelivery,
            preferredDate: payload.preferredDate || null,
            isProvided: false,
            orderedBy: orderedById,
            notes: payload.notes || `Order with ${processedItems.length} item(s)`,
            statusHistory: [
              { status: "Pending", timestamp: new Date(), notes: "Order created", updatedBy: orderedById },
            ],
            customer: {
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
              company: payload.customer?.company || "",
            },
            paymentMethod: payload.paymentMethod || "cod",
            paymentDetails: payload.paymentDetails || null,
          });

          await newOrder.save({ session });

          if (customerId) {
            await Customer.findByIdAndUpdate(customerId, {
              $push: { orders: newOrder._id }
            }).session(session);
            console.log(`✅ Order ${newOrder.orderId} added to customer's orders array (transaction)`);
          }
        });
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

      console.log("✅ Order created:", newOrder.orderId);
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

      let unitPrice = sizeObj.price;
      const qty = item.quantity;
      if (qty >= 5000 && sizeObj.bulkPrices?.[5000]) unitPrice = sizeObj.bulkPrices[5000] / 5000;
      else if (qty >= 2000 && sizeObj.bulkPrices?.[2000]) unitPrice = sizeObj.bulkPrices[2000] / 2000;
      else if (qty >= 1000 && sizeObj.bulkPrices?.[1000]) unitPrice = sizeObj.bulkPrices[1000] / 1000;
      else if (qty >= 500 && sizeObj.bulkPrices?.[500]) unitPrice = sizeObj.bulkPrices[500] / 500;

      const itemTotal = unitPrice * qty;
      productTotal += itemTotal;

      // ✅ Check if this item has a valid design using the helper function
      if (hasValidDesign(item)) {
        hasDesign = true;
      }

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
      });

      sizeObj.stock -= item.quantity;
      await product.save();
    }

    // ✅ COMPANY PRODUCT: Add design fee (₱500) ONLY if there's a design
    let totalAmount = productTotal;
    if (hasDesign) {
      totalAmount += DESIGN_AND_PRINTING_FEE;
    }

    const firstItem = processedItems[0] || {};
    const designDetails = {
      designSource: firstItem.designSource || "upload",
      designImage: firstItem.designImage || "",
      printSize: firstItem.printSize || "",
      printPlacement: firstItem.printPlacement || "",
      designNotes: firstItem.designNotes || "",
      files: firstItem.files || [],
    };

    const OrderId = await generateId("ORD");
    const newOrder = new Order({
      orderId: `${OrderId}-COMP`,
      customerName,
      customerEmail,
      customerPhone,
      address: payload.address,
      postalCode: payload.postalCode || "",
      items: processedItems,
      hasDesign: hasDesign, // ✅ Set hasDesign flag based on designSource
      designDetails: [designDetails],
      quantity: processedItems.reduce((sum, i) => sum + i.quantity, 0),
      amount: totalAmount,
      status: "Pending",
      paymentStatus: "Unpaid",
      receivingMode: payload.receivingMode,
      expectedDelivery,
      preferredDate: payload.preferredDate || null,
      isProvided: false,
      orderedBy: orderedById,
      notes: payload.notes || `Order with ${processedItems.length} item(s)`,
      statusHistory: [{ status: "Pending", timestamp: new Date(), notes: "Order created", updatedBy: orderedById }],
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        company: payload.customer?.company || "",
      },
      paymentMethod: payload.paymentMethod || "cod",
      paymentDetails: payload.paymentDetails || null,
    });

    await newOrder.save();

    if (customerId) {
      await Customer.findByIdAndUpdate(customerId, {
        $push: { orders: newOrder._id }
      });
      console.log(`✅ Order ${newOrder.orderId} added to customer's orders array (fallback)`);
    }

    console.log("✅ Order created (no transaction):", newOrder.orderId);
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
  async updateOrderStatus(orderId, newStatus, notes, productionSchedule = null, driverId = null, user = null) {
    try {
      newStatus = normalizeIncomingStatus(newStatus);

      console.log(`🔵 Updating order status for ${orderId} to ${newStatus}`);

      if (!VALID_STATUSES.includes(newStatus)) {
        return { success: false, message: "Invalid status" };
      }

      const order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: "Order not found" };
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

      // ─── SCHEDULED ──────────────────────────────────────────────────────
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

      // ─── OUT FOR DELIVERY ──────────────────────────────────────────────
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
        console.log(`✅ Driver ${driverId} assigned orders count incremented to ${incrementResult.data.assignedOrdersCount}`);
      }

      // ─── COMPLETED OR CANCELLED ────────────────────────────────────────
      if ((newStatus === "Completed" || newStatus === "Cancelled") && order.driverDetails?.driverId) {
        const decrementResult = await DriverService.decrementAssignedOrders(order.driverDetails.driverId);
        if (decrementResult.success) {
          console.log(`✅ Driver ${order.driverDetails.driverId} assigned orders count decremented to ${decrementResult.data.assignedOrdersCount}`);
        } else {
          console.warn(`⚠️ Could not release driver ${order.driverDetails.driverId}: ${decrementResult.message}`);
        }
      }

      // ─── CANCELLED: restore inventory ─────────────────────────────────
      if (newStatus === "Cancelled" && order.status !== "Cancelled" && !order.isProvided) {
        for (const item of order.items) {
          if (item.productId) {
            const product = await Product.findOne({ id: item.productId });
            if (product) {
              const sizeObj = product.sizes.find((s) => s.name === item.size);
              if (sizeObj) {
                sizeObj.stock += item.quantity;
                await product.save();
                console.log(`Inventory restored: +${item.quantity} to ${product.name} - ${item.size}`);
              }
            }
          }
        }
      }

      if (newStatus === "Completed") {
        await this.updatePaymentStatus(orderId, "Paid", order.totalAmount, user);
      }

      // ─── UPDATE ORDER ─────────────────────────────────────────────────
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
  // UPDATE ORDER
  // ─────────────────────────────────────────
  async updateOrder(orderId, payload, user = null) {
    try {
      const { orderId: _id, orderedAt, orderedBy, ...updateData } = payload;
      delete updateData.orderId;
      delete updateData.orderedAt;

      const order = await Order.findOne({ orderId });
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
            console.log(`Stock adjusted: ${quantityDiff > 0 ? "-" : "+"}${Math.abs(quantityDiff)}`);
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
            console.log(`Inventory restored on delete: +${order.quantity}`);
          }
        }
      }

      if (order.driverDetails?.driverId) {
        await DriverService.decrementAssignedOrders(order.driverDetails.driverId);
        console.log(`✅ Driver ${order.driverDetails.driverId} released on order deletion`);
      }

      if (order.orderedBy) {
        const customer = await Customer.findOne({ _id: order.orderedBy });
        if (customer) {
          await Customer.findByIdAndUpdate(customer._id, {
            $pull: { orders: order._id }
          });
          console.log(`✅ Order ${order.orderId} removed from customer's orders array`);
        }
      }

      await Order.findOneAndDelete({ orderId });

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
  async updatePaymentStatus(orderId, paymentStatus, amountPaid = null, user = null) {
    try {
      const validStatuses = ["Paid", "Partial", "Unpaid"];
      if (!validStatuses.includes(paymentStatus)) {
        return { success: false, message: "Invalid payment status" };
      }

      const order = await Order.findOne({ orderId });
      if (!order) {
        return { success: false, message: "Order not found" };
      }

      if (paymentStatus === "Partial" && (amountPaid === null || amountPaid === undefined)) {
        return { success: false, message: "amountPaid is required when marking payment as Partial" };
      }
      if (paymentStatus === "Partial" && Number(amountPaid) <= 0) {
        return { success: false, message: "amountPaid must be greater than 0" };
      }
      if (paymentStatus === "Partial" && Number(amountPaid) >= Number(order.amount)) {
        return { success: false, message: "amountPaid must be less than the order total for a Partial payment. Use 'Paid' instead." };
      }

      const oldPaymentStatus = order.paymentStatus;
      order.paymentStatus = paymentStatus;

      if (paymentStatus === "Partial" && amountPaid) {
        order.partialPayments = order.partialPayments || [];
        order.partialPayments.push({
          amount: amountPaid,
          date: new Date(),
          updatedBy: user ? user._id.toString() : null,
        });
      }

      if (paymentStatus === "Paid") {
        order.paymentDetails = order.paymentDetails || {};
        order.paymentDetails.paidAt = new Date();
      }

      order.updatedAt = new Date();
      if (user) order.updatedBy = user._id.toString();

      await order.save();

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
        order.status = "Completed";
        order.paymentStatus = "Paid";
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
            console.log(`✅ Driver ${order.driverDetails.driverId} released after delivery received`);
          }
        }
      }

      if (user) order.updatedBy = user._id?.toString() || user.email;

      await order.save();

      return { success: true, data: order, message: "Order marked as received successfully" };
    } catch (error) {
      console.error("Error toggling received status:", error);
      throw error;
    }
  }
}

module.exports = new OrderService();