// config/multer.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');
const path = require('path');
const fs = require('fs');

// Ensure local upload directories exist (fallback)
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// ──────────────────────────────────────────────
// CLOUDINARY STORAGE CONFIGURATIONS
// ──────────────────────────────────────────────

// Product images
const productCloudStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'beverage/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
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
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
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
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
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
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'txt', 'xlsx'],
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
// LOCAL STORAGE (FALLBACK)
// ──────────────────────────────────────────────

const productLocalStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/products');
    ensureDirectoryExists(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const templateLocalStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/templates');
    ensureDirectoryExists(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'template-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const designLocalStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/designs');
    ensureDirectoryExists(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'design-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const chatLocalStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/chat');
    ensureDirectoryExists(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// ──────────────────────────────────────────────
// STORAGE SELECTION (Cloudinary preferred)
// ──────────────────────────────────────────────

const useCloudinary = process.env.USE_CLOUDINARY === 'true' && 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY;

console.log(`📦 Image storage: ${useCloudinary ? 'Cloudinary 🚀' : 'Local 💾'}`);

// ──────────────────────────────────────────────
// FILE FILTERS
// ──────────────────────────────────────────────

const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed (.jpg, .jpeg, .png, .gif, .webp)'));
};

const chatFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|xlsx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only images and documents are allowed'));
};

// ──────────────────────────────────────────────
// MULTER INSTANCES
// ──────────────────────────────────────────────

const productUpload = multer({
  storage: useCloudinary ? productCloudStorage : productLocalStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFileFilter
});

const templateUpload = multer({
  storage: useCloudinary ? templateCloudStorage : templateLocalStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

const designUpload = multer({
  storage: useCloudinary ? designCloudStorage : designLocalStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFileFilter
});

const chatUpload = multer({
  storage: useCloudinary ? chatCloudStorage : chatLocalStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: chatFileFilter
});

// ──────────────────────────────────────────────
// EXPORT
// ──────────────────────────────────────────────

module.exports = {
  productUpload,
  templateUpload,
  designUpload,
  chatUpload,
  cloudinary,
  useCloudinary,
  
  // Utility functions
  getImageUrl: (file) => {
    if (!file) return null;
    // Cloudinary returns the URL in file.path
    return file.path || file.url || `/uploads/${file.filename}`;
  },
  
  getPublicId: (url) => {
    if (!url) return null;
    const match = url.match(/\/v\d+\/([^.]+)/);
    return match ? match[1] : null;
  },
  
  deleteImage: async (publicId) => {
    if (!useCloudinary || !publicId) return null;
    try {
      return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      return null;
    }
  },
  
  getOptimizedUrl: (url, options = {}) => {
    if (!url) return null;
    if (!useCloudinary || !url.includes('cloudinary.com')) return url;
    
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
  }
};