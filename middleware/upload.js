// middleware/upload.js - Add chat storage configuration
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage for product images
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/products');
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

// Configure storage for template images
const templateStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/templates');
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'template-' + uniqueSuffix + ext);
  }
});

const designStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/designs');
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'design-' + uniqueSuffix + ext);
  }
});

// ADD THIS: Configure storage for chat files (images, documents)
const chatStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/chat');
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'chat-' + uniqueSuffix + ext);
  }
});

// File filter - allow images and documents for chat
const chatFileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedDocTypes = /pdf|doc|docx|txt|xlsx/;
  const extname = path.extname(file.originalname).toLowerCase();
  const isImage = allowedImageTypes.test(extname);
  const isDoc = allowedDocTypes.test(extname);
  
  if (isImage || isDoc) {
    cb(null, true);
  } else {
    cb(new Error('Only images and documents are allowed (.jpg, .jpeg, .png, .gif, .webp, .pdf, .doc, .docx, .txt, .xlsx)'));
  }
};

// Create multer instance for chat
const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for chat files
  fileFilter: chatFileFilter
});

// File filter for images only (products, templates, designs)
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (.jpg, .jpeg, .png, .gif, .webp)'));
  }
};

// Create multer instances
const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: imageFileFilter
});

const templateUpload = multer({
  storage: templateStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: imageFileFilter
});

const designUpload = multer({
  storage: designStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for design files
  fileFilter: imageFileFilter
});

// Export all uploaders
module.exports = {
  productUpload,
  templateUpload,
  designUpload,
  chatUpload,  // Add this for chat file uploads

  // For backward compatibility
  single: (fieldName) => productUpload.single(fieldName),
  array: (fieldName, maxCount) => productUpload.array(fieldName, maxCount),
  fields: (fields) => productUpload.fields(fields)
};