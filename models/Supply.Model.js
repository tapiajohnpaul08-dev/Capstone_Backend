// models/Supply.Model.js
const mongoose = require('mongoose');

const supplySchema = new mongoose.Schema({
    supplyId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['inks', 'chemicals', 'packaging', 'raw_materials', 'maintenance', 'other'],
        required: true 
    },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    
    supplier: { type: String, required: true },
    supplierContact: { type: String, default: '' },
    leadTime: { type: Number, default: 7 },
    
    unit: { type: String, default: 'piece' },
    minOrderQuantity: { type: Number, default: 1 },
    
    unitCost: { type: Number, default: 0 },
    
    isActive: { type: Boolean, default: true },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Supply', supplySchema);