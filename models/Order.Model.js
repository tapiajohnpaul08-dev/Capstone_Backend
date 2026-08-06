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
    date: { type: Date, default: Date.now },
    updatedBy: { type: String },
  },
  { _id: false },
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
  items: [orderItemSchema],
  amount: { type: Number, default: 0 },
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
  isReceived: { type: Boolean, default: false },
  receivingMode: { type: String, enum: ["Pick-up", "Delivery"] },
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

  // FIX: `expectedDelivery` was declared twice in the original schema
  // (once optional, once `required: true`) - a duplicate object key where
  // the second definition silently wins in JS. Keeping a single definition.
  expectedDelivery: {
    type: Date,
    required: true,
  },

  preferredDate: {
    type: Date,
    required: false,
  },

  fromCustomerToCompanyDeliveryDate:{ type: Date, default: null },
  orderedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  notes: { type: String, default: "" },
  statusHistory: [statusHistorySchema],
  partialPayments: [partialPaymentSchema],
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
  updatedBy: { type: String },
});


// ─── Indexes for frequently-queried fields ─────────────────────────────────
// orderId already has a unique index via `unique: true` above.
orderSchema.index({ customerEmail: 1 });
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