// services/CustomerTemplateService.js
const Customer = require('../models/Customer.Model');
const generateId = require('../utils/generateId');
const cloudinary = require('../config/cloudinary');

class CustomerTemplateService {
  
  // Get all templates for a customer
  async getTemplates(customerId) {
    try {
      const customer = await Customer.findOne({ customerId });
      
      if (!customer) {
        return { success: false, message: 'Customer not found' };
      }
      
      // Transform templates to include both id and templateId
      const templates = (customer.templateDesigns || []).map(template => ({
        id: template.templateId,
        templateId: template.templateId,
        name: template.name || 'Untitled Template',
        imagePath: template.imagePath || '',
        thumbnail: template.imagePath || '', // Alias for consistency
        printSize: template.printSize || '',
        placement: template.placement || '',
        notes: template.notes || '',
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }));
      
      return { 
        success: true, 
        data: templates,
        count: templates.length
      };
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }
  
  // Get a single template by ID
  async getTemplateById(customerId, templateId) {
    try {
      const customer = await Customer.findOne({ customerId });
      
      if (!customer) {
        return { success: false, message: 'Customer not found' };
      }
      
      const template = customer.templateDesigns.find(t => t.templateId === templateId);
      
      if (!template) {
        return { success: false, message: 'Template not found' };
      }
      
      return { success: true, data: template };
    } catch (error) {
      console.error('Error fetching template:', error);
      throw error;
    }
  }
  
  // ─────────────────────────────────────────
  // CREATE TEMPLATE - WITH CLOUDINARY
  // ─────────────────────────────────────────
  async createTemplate(customerId, templateData, imageFile = null) {
    try {
      const customer = await Customer.findOne({ customerId });
      
      if (!customer) {
        return { success: false, message: 'Customer not found' };
      }
      
      let imagePath = '';
      let imagePublicId = null;
      
      // ✅ If imageFile exists, it's already uploaded to Cloudinary via multer
      if (imageFile) {
        // Cloudinary stores the URL in file.path
        if (imageFile.path) {
          imagePath = imageFile.path;
          imagePublicId = imageFile.public_id || this.getPublicIdFromUrl(imageFile.path);
        } else if (imageFile.filename) {
          // Fallback for local storage (should not happen with Cloudinary)
          imagePath = `/uploads/templates/${imageFile.filename}`;
        }
      } else if (templateData.existingImagePath) {
        // ✅ If we have an existing image path, check if it's already a Cloudinary URL
        if (templateData.existingImagePath.startsWith('http://') || 
            templateData.existingImagePath.startsWith('https://')) {
          // Already a Cloudinary URL
          imagePath = templateData.existingImagePath;
          imagePublicId = this.getPublicIdFromUrl(templateData.existingImagePath);
        } else {
          // Local path - we need to upload to Cloudinary first
          // For now, store as is (it will be a local path)
          imagePath = templateData.existingImagePath;
        }
      } else {
        // Default template image
        imagePath = '/uploads/templates/default-template.jpg';
      }
      
      const newTemplate = {
        templateId: await generateId('TPL'),
        name: templateData.name || 'Untitled Template',
        imagePath: imagePath,
        imagePublicId: imagePublicId,
        printSize: templateData.printSize || '',
        placement: templateData.placement || '',
        notes: templateData.notes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      customer.templateDesigns.push(newTemplate);
      await customer.save();
      
      return { 
        success: true, 
        message: 'Template saved successfully',
        data: newTemplate
      };
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }
  
  // Update a template
  async updateTemplate(customerId, templateId, updateData, imageFile = null) {
    try {
      const customer = await Customer.findOne({ customerId });
      
      if (!customer) {
        return { success: false, message: 'Customer not found' };
      }
      
      const templateIndex = customer.templateDesigns.findIndex(t => t.templateId === templateId);
      
      if (templateIndex === -1) {
        return { success: false, message: 'Template not found' };
      }
      
      // Handle image update
      if (imageFile) {
        // Delete old image from Cloudinary if it exists
        const oldImage = customer.templateDesigns[templateIndex];
        if (oldImage.imagePublicId) {
          await this.deleteImageFromCloudinary(oldImage.imagePublicId);
        }
        
        // Set new Cloudinary URL
        updateData.imagePath = imageFile.path || imageFile.url;
        updateData.imagePublicId = imageFile.public_id || this.getPublicIdFromUrl(imageFile.path || imageFile.url);
      }
      
      // Update fields
      const allowedUpdates = ['name', 'imagePath', 'imagePublicId', 'printSize', 'placement', 'notes'];
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          customer.templateDesigns[templateIndex][field] = updateData[field];
        }
      });
      customer.templateDesigns[templateIndex].updatedAt = new Date();
      
      await customer.save();
      
      return { 
        success: true, 
        message: 'Template updated successfully',
        data: customer.templateDesigns[templateIndex]
      };
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }
  
  // ─────────────────────────────────────────
  // DELETE TEMPLATE - With Cloudinary cleanup
  // ─────────────────────────────────────────
  async deleteTemplate(customerId, templateId) {
    try {
      const customer = await Customer.findOne({ customerId });
      
      if (!customer) {
        return { success: false, message: 'Customer not found' };
      }
      
      const template = customer.templateDesigns.find(t => t.templateId === templateId);
      
      if (!template) {
        return { success: false, message: 'Template not found' };
      }
      
      // ✅ Delete associated image from Cloudinary
      if (template.imagePublicId) {
        await this.deleteImageFromCloudinary(template.imagePublicId);
      }
      
      customer.templateDesigns = customer.templateDesigns.filter(t => t.templateId !== templateId);
      await customer.save();
      
      return { 
        success: true, 
        message: 'Template deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // HELPER: Get public ID from Cloudinary URL
  // ─────────────────────────────────────────
  getPublicIdFromUrl(url) {
    if (!url) return null;
    // Match the public ID from Cloudinary URL
    // Example: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/beverage/templates/template-12345
    const match = url.match(/\/v\d+\/([^.]+)/);
    return match ? match[1] : null;
  }

  // ─────────────────────────────────────────
  // HELPER: Delete image from Cloudinary
  // ─────────────────────────────────────────
  async deleteImageFromCloudinary(publicId) {
    if (!publicId) return null;
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log('✅ Deleted from Cloudinary:', publicId);
      return result;
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      return null;
    }
  }

  // ─────────────────────────────────────────
  // GET OPTIMIZED TEMPLATE IMAGE URL
  // ─────────────────────────────────────────
  getOptimizedTemplateImage(template, options = {}) {
    if (!template || !template.imagePath) return null;
    
    // If it's a Cloudinary URL, add transformations
    if (template.imagePath.includes('cloudinary.com')) {
      return this.getOptimizedCloudinaryUrl(template.imagePath, options);
    }
    return template.imagePath;
  }

  // ─────────────────────────────────────────
  // HELPER: Get optimized Cloudinary URL
  // ─────────────────────────────────────────
  getOptimizedCloudinaryUrl(url, options = {}) {
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
  }
  
  // Save design from order as template
  async saveDesignAsTemplate(customerId, orderDesignData, imageFile = null) {
    try {
      const templateData = {
        name: orderDesignData.templateName || `Design Template ${new Date().toLocaleDateString()}`,
        imagePath: orderDesignData.imagePath || '',
        printSize: orderDesignData.printSize || '',
        placement: orderDesignData.printPlacement || '',
        notes: orderDesignData.designNotes || ''
      };
      
      return await this.createTemplate(customerId, templateData, imageFile);
    } catch (error) {
      console.error('Error saving design as template:', error);
      throw error;
    }
  }
}

module.exports = new CustomerTemplateService();