const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema({
    materialId:  { type: String, required: true, unique: true },
    name:        { type: String, required: true, trim: true },
    description: { type: String },
    category:    { type: String, required: true, enum: ['paint', 'ink', 'adhesive', 'packaging', 'chemical', 'other'] },
    unit:        { type: String, required: true, enum: ['pcs', 'liters', 'kg', 'grams', 'rolls', 'sheets'] },
    stock:       { type: Number, required: true, min: 0, default: 0 },
    costPerUnit:        { type: Number, required: true, min: 0 },
    lowStockThreshold:  { type: Number, default: 10 },
}, { timestamps: true });

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);