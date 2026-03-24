// models/InventoryItem.Model.js
const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
    inventoryId: { type: String, required: true, unique: true },
    
    // Polymorphic reference - can be either Product or RawMaterial
    itemType: { 
        type: String, 
        required: true, 
        enum: ['Product', 'RawMaterial'],
        default: 'Product'
    },
    material: { 
        type: mongoose.Schema.Types.ObjectId, 
        refPath: 'itemType',  // Dynamic reference based on itemType
        required: true 
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
    location: { type: String } // Optional: warehouse location
}, { timestamps: true });

// Compound index to prevent duplicates for products with size
inventoryItemSchema.index({ item: 1, itemType: 1, sizeLabel: 1 }, { 
    unique: true,
    partialFilterExpression: { sizeLabel: { $exists: true } }
});

// Index for raw materials (no size label)
inventoryItemSchema.index({ item: 1, itemType: 1 }, { 
    unique: true,
    partialFilterExpression: { sizeLabel: { $exists: false } }
});

// Virtual for getting the actual item details
inventoryItemSchema.virtual('itemDetails', {
    refPath: 'itemType',
    localField: 'item',
    foreignField: '_id',
    justOne: true
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);