// models/Product.Model.js
const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0, min: 0 },
    bulkPrices: {
        500: { type: Number, default: null },
        1000: { type: Number, default: null },
        2000: { type: Number, default: null },
        5000: { type: Number, default: null }
    }
});

const productSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    subcategory: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, required: true }, // Stores relative path like '/uploads/products/product-xxx.jpg'    
    imagePublicId: { type: String, default: null }, // Cloudinary public ID

    sizes: [sizeSchema],
    minOrder: { type: Number, required: true, default: 500 },
    
    featured: { type: Boolean, default: false },
    popular: { type: Boolean, default: false },
    popularity: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    
    isActive: { type: Boolean, default: true },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Virtual to get total stock across all sizes
productSchema.virtual('totalStock').get(function() {
    return this.sizes.reduce((total, size) => total + (size.stock || 0), 0);
});

// Virtual to check if product is in stock
productSchema.virtual('inStock').get(function() {
    return this.sizes.some(size => (size.stock || 0) > 0);
});


module.exports = mongoose.model('Product', productSchema);