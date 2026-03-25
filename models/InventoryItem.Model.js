// models/InventoryItem.Model.js
const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
    inventoryId: { type: String, required: true, unique: true },
    
    // For products - matches your database field
    product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product',
        required: false 
    },
    
    // For raw materials
    itemType: { 
        type: String, 
        enum: ['RawMaterial'],
        required: false 
    },
    item: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'RawMaterial',
        required: false 
    },
    
    // For products only
    sizeLabel: { type: String },
    
    // Common fields
    unit: { type: String, required: true, enum: ['pcs', 'liters', 'kg', 'grams', 'rolls', 'sheets'] },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 500 },
    
    // Additional metadata
    notes: { type: String },
    lastRestocked: { type: Date },
    location: { type: String }
}, { timestamps: true });

// Update indexes to match your actual data structure
// Index for products (using 'product' field)
inventoryItemSchema.index({ product: 1, sizeLabel: 1 }, { 
    unique: true,
    partialFilterExpression: { sizeLabel: { $exists: true } }
});

// Index for raw materials (using 'item' field)
inventoryItemSchema.index({ item: 1, itemType: 1 }, { 
    unique: true,
    partialFilterExpression: { sizeLabel: { $exists: false } }
});

// Index for inventoryId
inventoryItemSchema.index({ inventoryId: 1 }, { unique: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);