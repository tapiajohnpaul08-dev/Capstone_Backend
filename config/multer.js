// config/multer.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');
const path = require('path');

// ──────────────────────────────────────────────
// CLOUDINARY STORAGE CONFIGURATIONS
// ──────────────────────────────────────────────

// Product images
const productCloudStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'beverage/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'AI', 'PSD', 'SVG', 'PDF'],
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `product-${uniqueSuffix}`;
    }
  }
});

// Template images
const templateCloudStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'beverage/templates',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'AI', 'PSD', 'SVG', 'PDF'],
    transformation: [
      { width: 600, height: 600, crop: 'limit', quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `template-${uniqueSuffix}`;
    }
  }
});

// Design images
const designCloudStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'beverage/designs',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'AI', 'PSD', 'SVG', 'PDF'],
    transformation: [
      { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `design-${uniqueSuffix}`;
    }
  }
});

// Chat files (images and documents)
const chatCloudStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'beverage/chat',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'AI', 'PSD', 'SVG', 'PDF', 'doc', 'docx', 'txt', 'xlsx'],
    resource_type: 'auto',
    transformation: [
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      return `chat-${uniqueSuffix}${ext}`;
    }
  }
});

// ──────────────────────────────────────────────
// FILE FILTERS
// ──────────────────────────────────────────────

const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|AI|PSD|SVG|PDF/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed (.jpg, .jpeg, .png, .gif, .webp, .AI, .PSD, .SVG, .PDF)'));
};

const chatFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|AI|PSD|SVG|PDF|doc|docx|txt|xlsx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only images and documents are allowed'));
};

// ──────────────────────────────────────────────
// MULTER INSTANCES - ALWAYS USE CLOUDINARY
// ──────────────────────────────────────────────

const productUpload = multer({
  storage: productCloudStorage, // ← Cloudinary
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: imageFileFilter
});

const templateUpload = multer({
  storage: templateCloudStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

const designUpload = multer({
  storage: designCloudStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

const chatUpload = multer({
  storage: chatCloudStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, 
  fileFilter: chatFileFilter
});

// ──────────────────────────────────────────────
// UTILITY FUNCTIONS
// ──────────────────────────────────────────────

const getPublicId = (url) => {
  if (!url) return null;
  const match = url.match(/\/v\d+\/([^.]+)/);
  return match ? match[1] : null;
};

const deleteImage = async (publicId) => {
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return null;
  }
};

const getOptimizedUrl = (url, options = {}) => {
  if (!url) return null;
  if (!url.includes('cloudinary.com')) return url;
  
  const { width, height, crop = 'limit', quality = 'auto' } = options;
  const transformations = [];
  
  if (width || height) {
    transformations.push(`c_${crop},w_${width || ''},h_${height || ''}`);
  }
  if (quality) transformations.push(`q_${quality}`);
  transformations.push('f_auto');
  
  if (transformations.length === 0) return url;
  
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  
  return `${parts[0]}/upload/${transformations.join(',')}/${parts[1]}`;
};

// ──────────────────────────────────────────────
// EXPORT
// ──────────────────────────────────────────────

module.exports = {
  productUpload,
  templateUpload,
  designUpload,
  chatUpload,
  cloudinary,
  useCloudinary: true, // Always true now
  getImageUrl: (file) => {
    if (!file) return null;
    return file.path || file.url || null;
  },
  getPublicId,
  deleteImage,
  getOptimizedUrl
};