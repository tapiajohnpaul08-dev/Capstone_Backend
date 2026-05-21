// models/InventoryItem.Model.js
const mongoose = require('mongoose');

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
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('InventoryItem', inventoryItemSchema);