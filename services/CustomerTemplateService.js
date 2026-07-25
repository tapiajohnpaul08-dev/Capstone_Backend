// services/CustomerTemplateService.js
const Customer = require('../models/Customer.Model');
const generateId = require('../utils/generateId');
const path = require('path');
const fs = require('fs');

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
  
  // Create a new template with image upload
  async createTemplate(customerId, templateData, imageFile = null) {
    try {
      const customer = await Customer.findOne({ customerId });
      
      if (!customer) {
        return { success: false, message: 'Customer not found' };
      }
      
      let imagePath = '';
      
      // Ensure uploads/templates directory exists
      const templatesDir = path.join(__dirname, '../uploads/templates');
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }
      
      if (imageFile) {
        // Direct upload (new file)
        imagePath = `/uploads/templates/${imageFile.filename}`;
      } else if (templateData.existingImagePath) {
        // Copy from existing design file
        const sourcePath = path.join(__dirname, '..', templateData.existingImagePath);
        const ext = path.extname(sourcePath);
        const filename = 'template-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
        const destPath = path.join(__dirname, '../uploads/templates', filename);
        
        console.log('Source path:', sourcePath);
        console.log('Destination path:', destPath);
        
        // Check if source file exists
        if (fs.existsSync(sourcePath)) {
          // Ensure destination directory exists
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.copyFileSync(sourcePath, destPath);
          imagePath = `/uploads/templates/${filename}`;
          console.log('Template image copied successfully to:', imagePath);
        } else {
          console.error('Source file not found:', sourcePath);
          imagePath = '/uploads/templates/default-template.jpg';
        }
      } else {
        imagePath = '/uploads/templates/default-template.jpg';
      }
      
      const newTemplate = {
        templateId: await generateId('TPL'),
        name: templateData.name || 'Untitled Template',
        imagePath: imagePath,
        printSize: templateData.printSize || '',
        placement: templateData.placement || '',
        notes: templateData.notes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('Creating template with:', {
        name: newTemplate.name,
        imagePath: newTemplate.imagePath,
        printSize: newTemplate.printSize,
        placement: newTemplate.placement
      });
      
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
        // Delete old image if exists and not default
        const oldImage = customer.templateDesigns[templateIndex].imagePath;
        if (oldImage && oldImage !== '/uploads/templates/default-template.jpg') {
          const oldImagePath = path.join(__dirname, '..', oldImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        updateData.imagePath = `/uploads/templates/${imageFile.filename}`;
      }
      
      // Update fields
      const allowedUpdates = ['name', 'imagePath', 'printSize', 'placement', 'notes'];
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
  
  // Delete a template (and its image)
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
      
      // Delete associated image if exists and not default
      if (template.imagePath && template.imagePath !== '/uploads/templates/default-template.jpg') {
        const imagePath = path.join(__dirname, '..', template.imagePath);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
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