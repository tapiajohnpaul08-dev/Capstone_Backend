// utils/generateItemId.js
const generateId = async (prefix = 'PRD', padding = 3) => {
    const year = new Date().getFullYear();
    // Generate random number for uniqueness
    const random = Math.floor(Math.random() * Math.pow(10, padding)).toString().padStart(padding, '0');
    const timestamp = Date.now().toString().slice(-4);
    
    // Handle different prefixes
    switch(prefix) {
        case 'INV': // Inventory
            return `${prefix}-${random}-${timestamp}`;
        case 'SUP': // Supply
            return `${prefix}-${year}-${random}`;
        case 'ORD': // Order
            return `${prefix}-${year}-${random}-`;
        case 'PRD': // Products
        default:
            return `${prefix}-${year}-${random}`;
    }
};

// Synchronous version for simple cases
const generateIdSync = (prefix = 'PRD', padding = 3) => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * Math.pow(10, padding)).toString().padStart(padding, '0');
    const timestamp = Date.now().toString().slice(-4);
    
    switch(prefix) {
        case 'INV': // Inventory
            return `${prefix}-${random}-${timestamp}`;
        case 'SUP': // Supply
            return `${prefix}-${year}-${random}`;
        case 'ORD': // Order
            return `${prefix}-${year}-${random}-${timestamp}`;
        case 'PRD': // Products
        default:
            return `${prefix}-${year}-${random}`;
    }
};

module.exports = generateId;
module.exports.generateIdSync = generateIdSync;