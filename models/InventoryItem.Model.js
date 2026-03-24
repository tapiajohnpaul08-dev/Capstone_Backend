const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
    inventoryId: { type: String, required: true, unique: true },
    product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sizeLabel:   { type: String, required: true },
    unit:        { type: String, required: true, enum: ['pcs', 'liters', 'kg', 'grams', 'rolls', 'sheets'] },
    stock:       { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 500 },
}, { timestamps: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);