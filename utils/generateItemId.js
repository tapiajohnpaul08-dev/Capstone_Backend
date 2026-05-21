// utils/generateItemId.js
const generateId = async (prefix = 'PRD', padding = 3) => {
    const year = new Date().getFullYear();
    // Generate random number for uniqueness
    const random = Math.floor(Math.random() * Math.pow(10, padding)).toString().padStart(padding, '0');
    const timestamp = Date.now().toString().slice(-4);
    
    if (prefix === 'INV') {
        return `${prefix}-${random}${timestamp}`;
    }
    
    return `${prefix}-${year}-${random}`;
};

// Synchronous version for simple cases
const generateIdSync = (prefix = 'PRD', padding = 3) => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * Math.pow(10, padding)).toString().padStart(padding, '0');
    return `${prefix}-${year}-${random}`;
};

module.exports = generateId;
module.exports.generateIdSync = generateIdSync;