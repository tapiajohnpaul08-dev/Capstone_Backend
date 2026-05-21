// models/DesignTemplate.js
const mongoose = require('mongoose');

const designTemplateSchema = new mongoose.Schema({
    customerId: { type: String, required: true, ref: 'Customer' },
    name: { type: String, required: true },
    image: { type: String, required: true }, // thumbnail URL
    printSize: { type: String },
    placement: { type: String }, // print placement
    notes: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DesignTemplate', designTemplateSchema);