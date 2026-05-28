// services/OrderService.js
const Order = require("../models/Order.Model");
const InventoryItem = require("../models/InventoryItem.Model");
const Product = require("../models/Product.Model");
const generateId = require("../utils/generateId");

class OrderService {
  // ─────────────────────────────────────────
  // CREATE ORDER (Supports both own cups and company products)
  // ─────────────────────────────────────────

  async createOrder(payload, user = null, userType = null) {
    try {
      console.log("\n=== 🔵 CREATE ORDER STARTED ===");
      console.log("Payload:", JSON.stringify(payload, null, 2));

      let orderedById;
      let customerEmail = payload.customerEmail;
      let customerName = payload.customerName;
      let customerPhone = payload.customerPhone;

      if (user && userType === "customer") {
        orderedById = user._id.toString();
        customerEmail = customerEmail || user.email;
        customerName = customerName || user.name;
        customerPhone = customerPhone || user.phone;
      } else if (!customerEmail) {
        return { success: false, message: "Customer email is required" };
      }

      // Handle Own Cups orders
// Handle Own Cups orders
if (payload.isProvided === true) {
  // Get the first item from the items array
  const firstItem = payload.items && payload.items.length > 0 ? payload.items[0] : {}
  
  const newOrder = new Order({
    orderId: await generateId(),
    customerName: customerName,
    customerEmail: customerEmail,
    customerPhone: customerPhone,
    address: payload.address,
    items: [{
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
    }],
    quantity: firstItem.quantity || payload.quantity,
    amount: payload.amount,
    status: "Pending",
    paymentStatus: "Unpaid",
    receivingMode: payload.receivingMode,
    expectedDelivery: this.calculateExpectedDelivery(payload.receivingMode),
    isProvided: true,
    orderedBy: orderedById,
    notes: payload.notes || "Customer provided items for printing",
    statusHistory: [{
      status: "Pending",
      timestamp: new Date(),
      notes: "Order created (customer provided items)",
      updatedBy: orderedById,
    }],
    customer: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      company: payload.customer?.company || '',
    },
    paymentMethod: payload.paymentMethod || 'cod',
    paymentDetails: payload.paymentDetails || null,
  });
  
  await newOrder.save();
  return {
    success: true,
    message: "Order created successfully",
    data: newOrder,
  };
}

      // Handle company products - always use items array
      const processedItems = [];
      let totalAmount = 0;

      // Get items from payload (supports both single and multiple)
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
          selectedTemplate: payload.selectedTemplate || null, // ← ADD THIS
          selectedTemplateId: payload.selectedTemplateId || null, // ← ADD THIS
        },
      ];

      for (const item of itemsToProcess) {
        const product = await Product.findOne({ id: item.productId });
        if (!product) {
          return { success: false, message: `Product not found: ${item.name}` };
        }

        const sizeObj = product.sizes.find((s) => s.name === item.size);
        if (!sizeObj) {
          return {
            success: false,
            message: `Size "${item.size}" not found for ${item.name}`,
          };
        }

        if (sizeObj.stock < item.quantity) {
          return {
            success: false,
            message: `Insufficient stock for ${item.name} - ${item.size}. Available: ${sizeObj.stock}`,
          };
        }

        // Calculate price
        let unitPrice = sizeObj.price;
        const qty = item.quantity;
        if (qty >= 5000 && sizeObj.bulkPrices?.[5000])
          unitPrice = sizeObj.bulkPrices[5000] / 5000;
        else if (qty >= 2000 && sizeObj.bulkPrices?.[2000])
          unitPrice = sizeObj.bulkPrices[2000] / 2000;
        else if (qty >= 1000 && sizeObj.bulkPrices?.[1000])
          unitPrice = sizeObj.bulkPrices[1000] / 1000;
        else if (qty >= 500 && sizeObj.bulkPrices?.[500])
          unitPrice = sizeObj.bulkPrices[500] / 500;

        const itemTotal = unitPrice * qty;
        totalAmount += itemTotal;

        processedItems.push({
          productId: item.productId,
          name: item.name,
          category: product.category,
          size: item.size,
          quantity: item.quantity,
          designSource: item.designSource || "upload",
          designImage: item.designImage || "", // ← ADD THIS - Critical!
          printSize: item.printSize || "",
          printPlacement: item.printPlacement || "",
          designNotes: item.designNotes || "",
          files: item.files || [],
          selectedTemplate: item.selectedTemplate || null, // ← ADD THIS
          selectedTemplateId: item.selectedTemplateId || null, // ← ADD THIS
          estimatedTotal: itemTotal,
          image: product.image,
        });

        // Deduct stock
        sizeObj.stock -= item.quantity;
        await product.save();
      }

      const newOrder = new Order({
        orderId: await generateId(),
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        address: payload.address,
        items: processedItems,
        quantity: processedItems.reduce((sum, i) => sum + i.quantity, 0),
        amount: totalAmount,
        status: "Pending",
        paymentStatus: "Unpaid",
        receivingMode: payload.receivingMode,
        expectedDelivery: this.calculateExpectedDelivery(payload.receivingMode),
        isProvided: false,
        orderedBy: orderedById,
        notes: payload.notes || `Order with ${processedItems.length} item(s)`,
        statusHistory: [
          {
            status: "Pending",
            timestamp: new Date(),
            notes: "Order created",
            updatedBy: orderedById,
          },
        ],
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          company: payload.customer?.company,
        },
      });

      await newOrder.save();
      console.log("✅ Order created:", newOrder.orderId);

      return {
        success: true,
        message: "Order created successfully",
        data: newOrder,
      };
    } catch (error) {
      console.error("❌ Error creating order:", error);
      throw error;
    }
  }
  // ─────────────────────────────────────────
  // CALCULATE EXPECTED DELIVERY DATE
  // ─────────────────────────────────────────
  calculateExpectedDelivery(receivingMode) {
    const now = new Date();
    let daysToAdd = 7; // Default 7 business days

    if (receivingMode === "Pick-up") {
      daysToAdd = 5; // Pick-up usually faster
    } else if (receivingMode === "Delivery") {
      daysToAdd = 6; // Delivery takes longer
    }

    // Add business days (skip weekends)
    let result = new Date(now);
    let daysAdded = 0;

    while (daysAdded < daysToAdd) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      // Skip Saturday (6) and Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }

    return result;
  }

  // ─────────────────────────────────────────
  // UPDATE ORDER STATUS (with inventory restoration on cancel)
  // ─────────────────────────────────────────
  async updateOrderStatus(
    orderId,
    newStatus,
    notes,
    productionSchedule = null,
    driverDetails = null,
    user = null,
  ) {
    try {
      console.log(`🔵 Updating order status for ${orderId} to ${newStatus}`);
      const validStatuses = [
        "Pending",
        "Scheduled",
        "In Production",
        "Out for Delivery",
        "Completed",
        "Cancelled",
      ];

      if (!validStatuses.includes(newStatus)) {
        return { success: false, message: "Invalid status" };
      }

      const order = await Order.findOne({ orderId });

      if (!order) {
        return { success: false, message: "Order not found" };
      }

      if (order.status === "Completed" || order.status === "Cancelled") {
        return {
          success: false,
          message: `Cannot change status of ${order.status.toLowerCase()} order`,
        };
      }

      // If status is changing to "Scheduled", save production schedule
      if (newStatus === "Scheduled" && productionSchedule) {
        order.productionSchedule = new Date(productionSchedule);
      }

      // If status is changing to "Out for Delivery" and has driver details
      if (
        newStatus === "Out for Delivery" &&
        driverDetails &&
        order.receivingMode === "Delivery"
      ) {
        order.driverDetails = {
          driverName: driverDetails.driverName,
          driverPhone: driverDetails.driverPhone,
          plateNumber: driverDetails.plateNumber,
          truckDescription: driverDetails.truckDescription,
          assignedAt: new Date(),
        };
      }

      // If cancelling order, restore inventory (only for company products)
      if (
        newStatus === "Cancelled" &&
        order.status !== "Cancelled" &&
        !order.isProvided
      ) {
        // Handle inventory restoration for multiple items
        for (const item of order.items) {
          if (item.productId) {
            const product = await Product.findOne({ id: item.productId });
            if (product) {
              const sizeObj = product.sizes.find((s) => s.name === item.size);
              if (sizeObj) {
                sizeObj.stock += item.quantity;
                await product.save();
                console.log(
                  `Inventory restored: +${item.quantity} to ${product.name} - ${item.size}`,
                );
              }
            }
          }
        }
      }

      const oldStatus = order.status;
      order.status = newStatus;

      // Build status history entry
      const historyEntry = {
        status: newStatus,
        timestamp: new Date(),
        notes: notes,
        updatedBy: user ? user._id.toString() : null,
      };

      // Add production schedule to history if provided
      if (productionSchedule) {
        historyEntry.productionSchedule = productionSchedule;
      }

      // Add driver details to history if provided
      if (driverDetails && order.receivingMode === "Delivery") {
        historyEntry.driverDetails = driverDetails;
      }

      order.statusHistory.push(historyEntry);
      order.updatedAt = new Date();

      if (user) {
        order.updatedBy = user._id.toString();
      }

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
  // UPDATE ORDER (with quantity adjustment)
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

      // If updating quantity and it's a company product, adjust inventory
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
              return {
                success: false,
                message: `Insufficient stock to increase quantity by ${quantityDiff}`,
              };
            }
            inventory.stock -= quantityDiff;
            await inventory.save();
            console.log(
              `Stock adjusted: ${quantityDiff > 0 ? "-" : "+"}${Math.abs(quantityDiff)}`,
            );
          }
        }
      }

      updateData.updatedAt = new Date();
      if (user) {
        updateData.updatedBy = user._id.toString();
      }

      const updatedOrder = await Order.findOneAndUpdate(
        { orderId },
        updateData,
        { new: true, runValidators: true },
      );

      if (!updatedOrder) {
        return { success: false, message: "Order not found" };
      }

      return {
        success: true,
        message: "Order updated successfully",
        data: updatedOrder,
      };
    } catch (error) {
      console.error("Error updating order:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // DELETE ORDER (with inventory restoration)
  // ─────────────────────────────────────────
  async deleteOrder(orderId) {
    try {
      const order = await Order.findOne({ orderId });

      if (!order) {
        return { success: false, message: "Order not found" };
      }

      // Restore inventory for company products if order is not completed or cancelled
      if (
        !order.isProvided &&
        order.status !== "Completed" &&
        order.status !== "Cancelled"
      ) {
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

      await Order.findOneAndDelete({ orderId });

      return {
        success: true,
        message: "Order deleted successfully",
        data: { orderId, status: order.status },
      };
    } catch (error) {
      console.error("Error deleting order:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ALL ORDERS (with filters)
  // ─────────────────────────────────────────
  async getAllOrders(filters = {}) {
    try {
      const query = {};

      if (filters.status) query.status = filters.status;
      if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
      if (filters.receivingMode) query.receivingMode = filters.receivingMode;
      if (filters.customerEmail) query.customerEmail = filters.customerEmail;
      if (filters.productId) query.productId = filters.productId;
      if (filters.orderedBy) query.orderedBy = filters.orderedBy;
      if (filters.isProvided !== undefined)
        query.isProvided = filters.isProvided === "true";

      if (filters.startDate) {
        query.orderedAt = { $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        query.orderedAt = {
          ...query.orderedAt,
          $lte: new Date(filters.endDate),
        };
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

      return {
        success: true,
        data: {
          ...order.toObject(),
          productDetails: productDetails,
        },
      };
    } catch (error) {
      console.error("Error fetching order:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ORDERS BY ORDERED BY (User who placed order)
  // ─────────────────────────────────────────
  async getOrdersByOrderedBy(orderedById) {
    try {
      const orders = await Order.find({ orderedBy: orderedById }).sort({
        orderedAt: -1,
      });

      return {
        success: true,
        data: orders,
        count: orders.length,
      };
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
      const orders = await Order.find({ customerEmail }).sort({
        orderedAt: -1,
      });

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
  async updatePaymentStatus(
    orderId,
    paymentStatus,
    amountPaid = null,
    user = null,
  ) {
    try {
      const validStatuses = ["Paid", "Partial", "Unpaid"];

      if (!validStatuses.includes(paymentStatus)) {
        return { success: false, message: "Invalid payment status" };
      }

      const order = await Order.findOne({ orderId });

      if (!order) {
        return { success: false, message: "Order not found" };
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

      order.updatedAt = new Date();
      if (user) {
        order.updatedBy = user._id.toString();
      }

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
      const scheduledOrders = await Order.countDocuments({
        status: "Scheduled",
      });
      const inProductionOrders = await Order.countDocuments({
        status: "In Production",
      });
      const outForDeliveryOrders = await Order.countDocuments({
        status: "Out for Delivery",
      });
      const completedOrders = await Order.countDocuments({
        status: "Completed",
      });
      const cancelledOrders = await Order.countDocuments({
        status: "Cancelled",
      });

      const totalRevenue = await Order.aggregate([
        { $match: { status: "Completed", paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const ownCupsOrders = await Order.countDocuments({ isProvided: true });
      const companyProductOrders = await Order.countDocuments({
        isProvided: false,
      });

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
        orderedAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
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
      const orders = await Order.find({ productId, isProvided: false }).sort({
        orderedAt: -1,
      });

      return { success: true, data: orders, count: orders.length };
    } catch (error) {
      console.error("Error fetching orders by product:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET RECENT ORDERS (for dashboard)
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
}

module.exports = new OrderService();
