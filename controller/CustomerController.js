const customerService = require('../services/CustomerServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class CustomerController {

    // POST /api/v1/customer/register
    register = asyncTryCatch(async (req, res, next) => {
        const response = await customerService.register(req.body);
        const status = response.success ? 201 : 400;
        res.status(status).json(response);
    });

    // POST /api/v1/customer/login
    login = asyncTryCatch(async (req, res, next) => {
        const response = await customerService.login(req.body);
        const status = response.success ? 200 : 401;
        res.status(status).json(response);
    });

    // GET /api/v1/customer/verify
    verifyToken = asyncTryCatch(async (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        const response = await customerService.verifyToken(token);
        const status = response.success ? 200 : 401;
        res.status(status).json(response);
    });

    // GET /api/v1/customer
    getAllCustomers = asyncTryCatch(async (req, res, next) => {
        const response = await customerService.getAllCustomers();
        res.status(200).json(response);
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

    // PUT /api/v1/customer/:customerId/password
    changePassword = asyncTryCatch(async (req, res, next) => {
        const response = await customerService.changePassword(req.params.customerId, req.body);
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