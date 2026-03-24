const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId:   { type: String, required: true, unique: true },
    name:        { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category:    { type: String, required: true },
    sizes: [
        {
            label:    { type: String, required: true },
            perPiece: { type: Number, required: true },
            qty500:   { type: Number, required: true },
            qty1000:  { type: Number, required: true },
            qty2000:  { type: Number, required: true },
            qty5000:  { type: Number, required: true },
        }
    ],
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);