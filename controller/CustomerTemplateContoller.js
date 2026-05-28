// controller/CustomerTemplateController.js
const customerTemplateService = require('../services/CustomerTemplateService');
const asyncTryCatch = require('../utils/tryAndCatch');
const { templateUpload } = require('../middleware/upload');

class CustomerTemplateController {
  
  // GET /api/v1/customer/templates
  getTemplates = asyncTryCatch(async (req, res, next) => {
    const customerId = req.customer.customerId;
    const response = await customerTemplateService.getTemplates(customerId);
    const status = response.success ? 200 : 400;
    res.status(status).json(response);
  });
  
  // GET /api/v1/customer/templates/:templateId
  getTemplateById = asyncTryCatch(async (req, res, next) => {
    const customerId = req.customer.customerId;
    const { templateId } = req.params;
    const response = await customerTemplateService.getTemplateById(customerId, templateId);
    const status = response.success ? 200 : 404;
    res.status(status).json(response);
  });
  
  // POST /api/v1/customer/templates (with image upload)
createTemplate = [
  templateUpload.single('image'),
  asyncTryCatch(async (req, res, next) => {
    const customerId = req.customer.customerId;
    
    // CRITICAL DEBUG LOGS
    console.log('=== TEMPLATE SAVE DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('existingImagePath:', req.body.existingImagePath);
    console.log('Has file:', !!req.file);
    
    // If there's an existingImagePath, we don't need the file upload
    // So we call the service without the file
    const response = await customerTemplateService.createTemplate(
      customerId, 
      req.body, 
      req.file  // This will be null when using existingImagePath
    );
    
    const status = response.success ? 201 : 400;
    res.status(status).json(response);
  })
];
  
  // PUT /api/v1/customer/templates/:templateId (with image upload)
  updateTemplate = [
    templateUpload.single('image'),
    asyncTryCatch(async (req, res, next) => {
      const customerId = req.customer.customerId;
      const { templateId } = req.params;
      const response = await customerTemplateService.updateTemplate(customerId, templateId, req.body, req.file);
      const status = response.success ? 200 : 400;
      res.status(status).json(response);
    })
  ];
  
  // DELETE /api/v1/customer/templates/:templateId
  deleteTemplate = asyncTryCatch(async (req, res, next) => {
    const customerId = req.customer.customerId;
    const { templateId } = req.params;
    const response = await customerTemplateService.deleteTemplate(customerId, templateId);
    const status = response.success ? 200 : 404;
    res.status(status).json(response);
  });
  
  // POST /api/v1/customer/templates/save-from-order (with image upload)
  saveDesignAsTemplate = [
    templateUpload.single('image'),
    asyncTryCatch(async (req, res, next) => {
      const customerId = req.customer.customerId;
      const response = await customerTemplateService.saveDesignAsTemplate(customerId, req.body, req.file);
      const status = response.success ? 201 : 400;
      res.status(status).json(response);
    })
  ];
}

module.exports = new CustomerTemplateController();