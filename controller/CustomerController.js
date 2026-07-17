const customerService = require('../services/CustomerServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class CustomerController {

    // POST /api/v1/customer/register
    register = asyncTryCatch(async (req, res, next) => {
        const { otp, ...customerData } = req.body;
        
        // Validate OTP is provided
        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'OTP is required for registration'
            });
        }
        
        // Register with OTP verification
        const response = await customerService.register(customerData, otp);
        
        if (response.success) {
            // Auto-login after successful registration
            const loginResponse = await customerService.login({
                email: customerData.email,
                password: customerData.password
            });
            
            if (loginResponse.success) {
                // Return registration data with token for auto-login
                return res.status(201).json({
                    success: true,
                    message: 'Registration successful. You are now logged in.',
                    data: {
                        customer: response.data,
                        token: loginResponse.data.token
                    }
                });
            }
        }
        
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // POST /api/v1/customer/register-without-auto-login (alternative - no auto-login)
    registerWithoutAutoLogin = asyncTryCatch(async (req, res, next) => {
        const { otp, ...customerData } = req.body;
        
        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'OTP is required for registration'
            });
        }
        
        const response = await customerService.register(customerData, otp);
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // POST /api/v1/customer/login
    login = asyncTryCatch(async (req, res, next) => {
        const response = await customerService.login(req.body);
        const status = response.success ? 200 : 401;
        res.status(status).json(response);
    });

    // POST /api/v1/customer/logout
    logout = asyncTryCatch(async (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }
        
        const response = await customerService.logout(token);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // GET /api/v1/customer/verify
    verifyToken = asyncTryCatch(async (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        const response = await customerService.verifyToken(token);
        const status = response.success ? 200 : 401;
        res.status(status).json(response);
    });

    // GET /api/v1/customer/profile
    getProfile = asyncTryCatch(async (req, res, next) => {
        res.status(200).json({
            success: true,
            data: req.customer
        });
    });

    // GET /api/v1/customer/:customerId
    getCustomerById = asyncTryCatch(async (req, res, next) => {
        const response = await customerService.getCustomerById(req.params.customerId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PUT /api/v1/customer/:customerId
    updateCustomer = asyncTryCatch(async (req, res, next) => {
        const response = await customerService.updateCustomer(req.params.customerId, req.body);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PUT /api/v1/customer/:customerId/password (old method - keep for backward compatibility)
    changePassword = asyncTryCatch(async (req, res, next) => {
        const response = await customerService.changePassword(req.params.customerId, req.body);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // POST /api/v1/customer/request-password-otp
    requestPasswordChangeOtp = asyncTryCatch(async (req, res, next) => {
        // Get email from authenticated user or request body
        const email = req.customer?.email || req.body.email;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        
        const response = await customerService.requestPasswordChangeOtp(email);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // POST /api/v1/customer/update-password-with-otp
    updatePasswordWithOtp = asyncTryCatch(async (req, res, next) => {
        const email = req.customer?.email || req.body.email;
        const { otp, newPassword } = req.body;
        
        if (!email || !otp || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email, OTP, and new password are required'
            });
        }
        
        const response = await customerService.updatePasswordWithOtp(email, otp, newPassword);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // PUT /api/v1/customer/update-password-with-current/:customerId
    updatePasswordWithCurrent = asyncTryCatch(async (req, res, next) => {
        const { customerId } = req.params;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }
        
        const response = await customerService.updatePasswordWithCurrent(customerId, currentPassword, newPassword);
        const status = response.success ? 200 : 400;
        res.status(status).json(response);
    });

    // DELETE /api/v1/customer/:customerId
    deleteCustomer = asyncTryCatch(async (req, res, next) => {
        const response = await customerService.deleteCustomer(req.params.customerId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });
}

module.exports = new CustomerController();