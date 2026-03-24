const adminService = require('../services/AdminServices');
const asyncTryCatch = require('../utils/tryAndCatch');

class AdminController {

    // POST /api/v1/admin/register
    createAdmin = asyncTryCatch(async (req, res, next) => {
        const response = await adminService.createAdmin(req.body);
        res.status(201).json(response);
    });

    // POST /api/v1/admin/login
    login = asyncTryCatch(async (req, res, next) => {
        const response = await adminService.login(req.body);
        const status = response.success ? 200 : 401;
        res.status(status).json(response);
    });

    // GET /api/v1/admin/verify
    verifyToken = asyncTryCatch(async (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        const response = await adminService.verifyToken(token);
        const status = response.success ? 200 : 401;
        res.status(status).json(response);
    });

    // GET /api/v1/admin
    getAllAdmins = asyncTryCatch(async (req, res, next) => {
        const response = await adminService.getAllAdmins();
        res.status(200).json(response);
    });

    // GET /api/v1/admin/:adminId
    getAdminById = asyncTryCatch(async (req, res, next) => {
        const response = await adminService.getAdminById(req.params.adminId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // PUT /api/v1/admin/:adminId
    updateAdmin = asyncTryCatch(async (req, res, next) => {
        const response = await adminService.updateAdmin(req.params.adminId, req.body);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });

    // DELETE /api/v1/admin/:adminId
    deleteAdmin = asyncTryCatch(async (req, res, next) => {
        const response = await adminService.deleteAdmin(req.params.adminId);
        const status = response.success ? 200 : 404;
        res.status(status).json(response);
    });
}

module.exports = new AdminController();