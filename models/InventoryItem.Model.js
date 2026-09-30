// models/InventoryItem.Model.js
const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    type:          { type: String, enum: ['in', 'out'], required: true },
    quantity:      { type: Number, required: true, min: 1 },
    previousStock: { type: Number, required: true },
    newStock:      { type: Number, required: true },
    note:          { type: String, required: true, trim: true, maxlength: 500 },
    imageUrl:      { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    performedBy:   { type: String, default: '' },
    performedById: { type: String, default: '' },
    createdAt:     { type: Date,   default: Date.now },
  },
  { _id: true },
);

const inventoryItemSchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true },
    itemType: { type: String, enum: ['product', 'supply'], required: true },
    itemRef: { type: mongoose.Schema.Types.ObjectId, required: true },
    
    stock: { type: Number, required: true, default: 0, min: 0 },
    unit: { type: String, default: 'piece' },
    threshold: { type: Number, default: 100, min: 0 },
    unitCost: { type: Number, default: 0 },
    lastRestocked: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['In Stock', 'Low Stock', 'Out of Stock'], default: 'In Stock' },
    
    location: { type: String, default: 'Warehouse A' },
    binLocation: { type: String, default: '' },
    batchNumber: { type: String, default: '' },
    
    stockMovements: { type: [stockMovementSchema], default: [] },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});


module.exports = mongoose.model('InventoryItem', inventoryItemSchema);