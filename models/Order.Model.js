// models/Order.Model.js
const mongoose = require("mongoose");

const designDetailsSchema = new mongoose.Schema({
  designSource: { type: String, enum: ["upload", "saved", "no-design"] },
  printSize: { type: String },
  printPlacement: { type: String },
  designNotes: { type: String },
  files: [
    {
      name: { type: String, default: "" },
      size: { type: Number, default: 0 },
      type: { type: String, default: "" },
      path: { type: String, default: "" },
    },
  ],
  imagePaths: { type: [String], default: [] },
  selectedTemplateId: { type: String },
  selectedTemplate: {
    id: { type: String },
    name: String,
    thumbnail: String,
    printSize: String,
    placement: String,
    notes: String,
  },
});

const orderItemSchema = new mongoose.Schema({
  productId: { type: String },
  name: { type: String, required: true },
  category: { type: String },
  size: { type: String },
  quantity: { type: Number, required: true },
  designSource: { type: String, enum: ["upload", "saved", "no-design"] },
  designImage: { type: String, default: "" },
  printSize: { type: String },
  printPlacement: { type: String },
  designNotes: { type: String },
  files: [
    {
      name: { type: String, default: "" },
      size: { type: Number, default: 0 },
      type: { type: String, default: "" },
      path: { type: String, default: "" },
    },
  ],
  selectedTemplateId: { type: String },
  selectedTemplate: {
    id: { type: String },
    name: String,
    thumbnail: String,
    printSize: String,
    placement: String,
    notes: String,
  },
  estimatedTotal: { type: Number, default: 0 },
  image: { type: String },

  // ✅ NEW — snapshot of rim diameter at time of order.
  rimDiameter: { type: Number, default: null },

  // ✅ NEW — item kind for filtering & reporting.
  itemType: {
    type: String,
    enum: ['cup', 'lid', 'container', 'bag', 'utensil', 'straw', 'other'],
    default: 'cup',
  },
});

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String },
    productionSchedule: { type: String, default: "" },
    updatedBy: { type: String },
    // Snapshot of the driver at the time of this status change, so the
    // history keeps an accurate record even if the driver is later
    // reassigned or their info changes.
    driverDetails: {
      driverName: { type: String },
      driverPhone: { type: String },
      plateNumber: { type: String },
      truckDescription: { type: String },
    },
  },
  { _id: false },
);

// FIX: `driverId` was missing here. OrderService.updateOrderStatus sets
// `order.driverDetails.driverId = driver.driverId`, but because this schema
// didn't declare that field, Mongoose silently stripped it before saving
// (strict mode default). That meant `order.driverDetails.driverId` was
// always undefined on read, breaking driver-release logic in
// updateOrderStatus/deleteOrder (DriverService.decrementAssignedOrders was
// effectively never called with a real ID for previously-saved orders).
const driverDetailsSchema = new mongoose.Schema(
  {
    driverId: { type: String, default: "" },
    driverName: { type: String, default: "" },
    driverPhone: { type: String, default: "" },
    plateNumber: { type: String, default: "" },
    truckDescription: { type: String, default: "" },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const partialPaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    referenceNumber: { type: String, default: null },
    date: { type: Date, default: Date.now },
    updatedBy: { type: String },
  },
  { _id: false },
);

const pricingHistorySchema = new mongoose.Schema(
  {
    field: { type: String, required: true },          // 'designFee' | 'quantity' | 'shippingFee' | 'amount' | 'deliveryMethod'
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    updatedBy: { type: String },                       // admin name
    updatedById: { type: String },                     // admin id (optional)
    notes: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Delay tracking ─────────────────────────────────────────────────
// Orthogonal to `status` — an order can be delayed at any stage.
// Kept as an array so multiple delays are preserved as history.
const delayInfoSchema = new mongoose.Schema(
  {
    isDelayed: { type: Boolean, default: false },
    category: {
      type: String,
      enum: [
        'material_shortage',
        'production_issue',
        'logistics',
        'weather',
        'customer_request',
        'payment',
        'other',
      ],
      default: 'other',
    },
    reason: { type: String, default: '' },   // customer-facing
    notes:  { type: String, default: '' },   // admin-only

    originalExpectedDelivery: { type: Date, default: null },
    newExpectedDelivery:      { type: Date, default: null },

    reportedBy: { type: String, default: '' },
    reportedByType: {
      type: String,
      enum: ['admin', 'driver', 'system'],
      default: 'admin',
    },
    reportedAt: { type: Date,   default: null },
    resolvedAt: { type: Date,   default: null },
    resolvedBy: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  customerName: { type: String },
  customerEmail: { type: String },
  customerPhone: { type: String },
  address: { type: String },
  postalCode: { type: String },
  customerId: { type: String, ref: "Customer" },
  productId: { type: String },
  productName: { type: String },
  size: { type: String },
  quantity: { type: Number, required: true },
  designDetails: [designDetailsSchema],
  hasDesign: { type: Boolean, default: false },
  items: [orderItemSchema],
  amount: { type: Number, default: 0 },
  downpayment: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  // NOTE: "Ready to Pick-up" is intentionally NOT a DB status. It is a
  // *display-only* alias for "Out for Delivery" shown to admins when
  // receivingMode === "Pick-up" (see frontend composables/useOrderStatus.js
  // getDisplayStatus/toDbStatus). Storing "Ready to Pick-up" directly here
  // would fragment order-status statistics/queries (getOrderStatistics,
  // filters, etc. all query on "Out for Delivery").
  status: {
    type: String,
    enum: [
      "Pending",
      "Confirmed",
      "Scheduled",
      "In Production",
      "Out for Delivery",
      "Completed",
      "Cancelled",
    ],
    default: "Pending",
  },
  paymentStatus: {
    type: String,
    enum: ["Unpaid", "Partial", "Paid"],
    default: "Unpaid",
  },
  paymentMethod: {
    type: String,
    enum: ["cod", "bank_transfer"],
    default: "cod",
  },
  paymentDetails: {
    bankName: { type: String, default: "" },
    referenceNumber: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    proofOfPayment: { type: String, default: "" },
  },
  shippingFee: { type: Number, default: 0 },
  designFee: {
  type: Number,
  default: 500,
  min: 0,
},

negotiationStatus: {
  type: String,
  enum: ['none', 'in_progress', 'finalized'],
  default: 'none',
},


pricingHistory: {
  type: [pricingHistorySchema],
  default: [],
},

// Optional: track what the customer has accepted
acceptedQuote: {
  messageId: { type: String, default: null },
  acceptedAt: { type: Date, default: null },
  acceptedBy: { type: String, default: '' },
  snapshot: {
    quantity: { type: Number },
    designFee: { type: Number },
    shippingFee: { type: Number },
    deliveryMethod: { type: String },
    totalAmount: { type: Number },
  },
},
  
  activePaymentRequestMessageId: { type: String, default: null },

  isReceived: { type: Boolean, default: false },
  receivingMode: { type: String, enum: ["Pick-up", "Delivery"] },
  useCourier: { type: Boolean, default: false },
  courierName: { type: String, default: "" },
  deliveryMethod: { type: String, enum: ["Delivery", "Pick-up"] },
  supplyType: { type: String, enum: ["Own Items", "Company Cups"] },
  type: { type: String, enum: ["own-items", "company-product"] },
  
  productionSchedule: { type: Date, default: null },
  driverDetails: driverDetailsSchema,
  isProvided: { type: Boolean, default: false },
  isCartOrder: { type: Boolean, default: false },
  source: { type: String },
  orderedBy: { type: String },
  orderedById: { type: String },


  expectedDelivery: {
    type: Date,
    required: true,
  },

  preferredDate: {
    type: Date,
    required: false,
  },

  fromCustomerToCompanyDeliveryDate:{ type: Date, default: null },
  dropOffStatus: {type: String, enum: ["Pending", "Received"], default: "Pending"},
  orderedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  notes: { type: String, default: "" },
  statusHistory: [statusHistorySchema],
  partialPayments: [partialPaymentSchema],
  delayHistory: { type: [delayInfoSchema], default: [] },
  customer: {
    name: { type: String },
    company: { type: String, default: "" },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    saveAsDefault: { type: Boolean, default: false },
  },
  fulfillment: {
    method: { type: String, enum: ["delivery", "pickup"] },
    deliveryAddress: { type: String, default: "" },
    sameAsCustomer: { type: Boolean, default: false },
  },
  proofOfDelivery: { type: String, default: null }, // ← Add this field
  updatedBy: { type: String },
});


// ─── Virtual: current delay state (derived) ─────────────────────────────
orderSchema.virtual('isCurrentlyDelayed').get(function () {
  const history = this.delayHistory || [];
  const last = history[history.length - 1];
  return !!(last && last.isDelayed);
});

orderSchema.virtual('currentDelay').get(function () {
  const history = this.delayHistory || [];
  const last = history[history.length - 1];
  return last && last.isDelayed ? last : null;
});

orderSchema.index({ 'delayHistory.isDelayed': 1 });
orderSchema.index({ 'delayHistory.reportedAt': -1 });
orderSchema.index({ orderedBy: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ receivingMode: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderedAt: -1 });
// Compound index: the admin orders list is very commonly filtered by
// status and sorted by most-recent first.
orderSchema.index({ status: 1, orderedAt: -1 });

// NOTE: removed the old `orderSchema.index({ orderNumber: 1 }, { unique:
// true, sparse: true })` - `orderNumber` was never a field on this schema
// (the real identifier field is `orderId`, already uniquely indexed above),
// so that index was silently indexing a non-existent field.

module.exports = mongoose.model("Order", orderSchema);