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
      console.log("User:", user ? user.email : "No user");
      console.log("UserType:", userType);

      // Determine who placed the order
      let orderedById;
      let customerEmail = payload.customerEmail;
      let customerName = payload.customerName;
      let customerPhone = payload.customerPhone;

      if (user && userType === "customer") {
        orderedById = user._id.toString();
        customerEmail = customerEmail || user.email;
        customerName = customerName || user.name;
        customerPhone = customerPhone || user.phone;
        console.log("Customer order from:", customerEmail);
      } else if (user && userType === "admin") {
        orderedById = user._id.toString();
        if (!payload.customerEmail) {
          return {
            success: false,
            message: "Customer email is required when creating order as admin",
          };
        }
        console.log("Admin order for customer:", customerEmail);
      } else {
        // Guest order (no authentication)
        if (!customerEmail) {
          return {
            success: false,
            message: "Customer email is required for guest orders",
          };
        }
        orderedById = null;
        console.log("Guest order from:", customerEmail);
      }

      // Sanitize designDetails — supports:
      //   • files as an array of objects: [{ name, size, type, path? }]
      //   • files as a JSON string (sometimes sent by frontend): "[{...}]"
      //   • imagePaths as an array of plain URL/path strings
      const sanitizedDesignDetails = (payload.designDetails || []).map(detail => {
        // Normalize files: parse if accidentally stringified
        let rawFiles = detail.files || [];
        if (typeof rawFiles === 'string') {
          try { rawFiles = JSON.parse(rawFiles); } catch { rawFiles = []; }
        }
        const files = rawFiles.map(f => {
          if (typeof f === 'string') {
            // plain path string — store in path field
            return { name: '', size: 0, type: '', path: f };
          }
          return {
            name: f.name || '',
            size: typeof f.size === 'number' ? f.size : 0,
            type: f.type || '',
            path: f.path || ''
          };
        });

        // imagePaths: array of plain strings (saved design paths / URLs)
        const imagePaths = (detail.imagePaths || []).filter(p => typeof p === 'string');

        return {
          designSource: detail.designSource,
          printSize: detail.printSize,
          printPlacement: detail.printPlacement,
          designNotes: detail.designNotes,
          selectedTemplateId: detail.selectedTemplateId || null,
          selectedTemplate: detail.selectedTemplate || null,
          files,
          imagePaths
        };
      });
      // Handle Own Cups orders (customer provides their own items)
      if (payload.isProvided === true) {
        console.log("📦 Processing OWN CUPS order");

       

        const newOrder = new Order({
          orderId: await generateId(),
          customerName: customerName,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
          address: payload.address,
          productId: null,
          productName: payload.productName || "Customer Provided Items",
          size: payload.size || "Custom",
          quantity: payload.quantity,
          designDetails: sanitizedDesignDetails,
          amount: payload.amount || 0,
          status: "Pending",
          paymentStatus: "Unpaid",
          receivingMode: payload.receivingMode,
          expectedDelivery: this.calculateExpectedDelivery(
            payload.receivingMode,
          ),
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
        });

        await newOrder.save();
        console.log("✅ Own cups order created:", newOrder.orderId);

        return {
          success: true,
          message: "Order created successfully",
          data: newOrder,
        };
      }

      // Handle Company Products orders (we supply the products)
      console.log("🏭 Processing COMPANY PRODUCT order");

      // Find product - using 'id' field (your Product model uses 'id', not 'productId')
      const product = await Product.findOne({ id: payload.productId });
      if (!product) {
        console.error("Product not found:", payload.productId);
        return {
          success: false,
          message: `Product not found with ID: ${payload.productId}`,
        };
      }
      console.log("Product found:", product.name);

      // Validate size exists for the product
      const sizeExists = product.sizes.some(
        (s) => s.name.toLowerCase() === payload.size.toLowerCase(),
      );
      if (!sizeExists) {
        const availableSizes = product.sizes.map((s) => s.name).join(", ");
        return {
          success: false,
          message: `Size "${payload.size}" does not exist. Available sizes: ${availableSizes}`,
        };
      }
      console.log("Size validated:", payload.size);

      // Find inventory item for stock check
      const inventory = await InventoryItem.findOne({
        itemRef: product._id,
        itemType: "product",
      });

      if (!inventory) {
        return {
          success: false,
          message: `Inventory not found for ${product.name}. Please contact support.`,
        };
      }
      // Find the specific size on the product
      const sizeObj = product.sizes.find(
        (s) => s.name.toLowerCase() === payload.size.toLowerCase(),
      );

      // Check stock on the size
      if (sizeObj.stock < payload.quantity) {
        return {
          success: false,
          message: `Insufficient stock. Available: ${sizeObj.stock}, Requested: ${payload.quantity}`,
        };
      }

      // Deduct stock from the size on the Product model
      const previousStock = sizeObj.stock;
      sizeObj.stock -= payload.quantity;
      await product.save();
      console.log(`Stock deducted: ${previousStock} → ${sizeObj.stock}`);

      // Create the order
      const newOrder = new Order({
        orderId: await generateId(),
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        address: payload.address,
        productId: payload.productId,
        productName: product.name,
        size: payload.size,
        quantity: payload.quantity,
        designDetails: sanitizedDesignDetails,
        amount: payload.amount,
        status: payload.status || "Pending",
        paymentStatus: payload.paymentStatus || "Unpaid",
        receivingMode: payload.receivingMode,
        expectedDelivery: this.calculateExpectedDelivery(payload.receivingMode),
        isProvided: false,
        orderedBy: orderedById,
        notes: payload.notes || "",
        statusHistory: [
          {
            status: payload.status || "Pending",
            timestamp: new Date(),
            notes: payload.notes || "Order created",
            updatedBy: orderedById,
          },
        ],
      });

      await newOrder.save();
      console.log("✅ Company product order created:", newOrder.orderId);

      return {
        success: true,
        message: "Order created successfully",
        data: {
          ...newOrder.toObject(),
          inventoryDetails: {
            productName: product.name,
            size: inventory.sizeLabel,
            previousStock: previousStock,
            newStock: inventory.stock,
            deducted: payload.quantity,
            inventoryId: inventory.itemId,
          },
        },
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
  async updateOrderStatus(orderId, newStatus, notes = "", user = null) {
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

      // If cancelling order, restore inventory (only for company products)
      if (
        newStatus === "Cancelled" &&
        order.status !== "Cancelled" &&
        !order.isProvided
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
            console.log(
              `Inventory restored: +${order.quantity} to ${inventory.sizeLabel}`,
            );
          }
        }
      }

      const oldStatus = order.status;
      order.status = newStatus;
      order.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        notes: notes,
        updatedBy: user ? user._id.toString() : null,
      });
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