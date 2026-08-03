// models/Order.Model.js
const mongoose = require("mongoose");

const fileMetaSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    size: { type: Number, default: 0 },
    type: { type: String, default: "" },
    path: { type: String, default: "" },
  },
  { _id: false },
);

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
  selectedTemplateId: { type: String }, // ← CHANGE from ObjectId to String
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
  designImage: { type: String, default: "" }, // Add this if not exists

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
  selectedTemplateId: { type: String }, // ← CHANGE from ObjectId to String
  selectedTemplate: {
    // ← ADD this if not exists
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

const statusHistorySchema = new mongoose.Schema({
  status: { type: String },
  timestamp: { type: Date, default: Date.now },
  notes: { type: String },
  productionSchedule: { type: String, default: "" },
  updatedBy: { type: String },
});

const driverDetailsSchema = new mongoose.Schema(
  {
    driverName: { type: String, default: "" },
    driverPhone: { type: String, default: "" },
    plateNumber: { type: String, default: "" },
    truckDescription: { type: String, default: "" },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const partialPaymentSchema = new mongoose.Schema({
  amount: { type: Number },
  date: { type: Date, default: Date.now },
  updatedBy: { type: String },
});

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
  // Add to orderSchema
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
  expectedDelivery: { type: Date },
  expectedDelivery: {
    type: Date,
    required: true,
  },

  preferredDate: {
    type: Date,
    required: false,
  },

  preferredTime: {
    type: String,
    enum: [
      "Morning (8AM - 12PM)",
      "Afternoon (1PM - 5PM)",
      "Evening (5PM - 8PM)",
      "Anytime",
      "",
    ],
    default: "",
  },
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

orderSchema.index({ customerEmail: 1 });
orderSchema.index({ orderedBy: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Order", orderSchema);
