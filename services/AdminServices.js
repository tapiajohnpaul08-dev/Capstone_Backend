const Admin = require('../models/Admin_Model');
const generateId = require('../utils/generateId');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

class AdminService {

    // ─────────────────────────────────────────
    // CREATE
    // ─────────────────────────────────────────
    async createAdmin(payload) {
        try {
            const existingAdmin = await Admin.findOne({
                $or: [
                    { email: payload.email.toLowerCase() },
                    { userName: payload.userName }
                ]
            });

            if (existingAdmin) {
                return {
                    success: false,
                    message: 'An admin with this email or username already exists'
                };
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(payload.password, salt);

            const newAdmin = new Admin({
                adminId:    await generateId(),
                firstName:  payload.firstName,
                middleName: payload.middleName || '',
                lastName:   payload.lastName,
                userName:   payload.userName,
                email:      payload.email,
                password:   hashedPassword,
                role:       payload.role,          // ✅ Fixed: was payload.rolem
            });

            await newAdmin.save();

            const adminData = newAdmin.toObject();
            delete adminData.password;

            return {
                success: true,
                message: 'Admin created successfully',
                data: adminData
            };

        } catch (error) {
            console.error('Error creating admin:', error);
            throw error;                           // ✅ Fixed: was silently swallowed
        }
    }

    // ─────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────
    async login(payload) {
        try {
            const { email, password } = payload;

            const admin = await Admin.findOne({ email: email.toLowerCase() });

            if (!admin) {
                return {
                    success: false,
                    message: 'Invalid email or password'
                };
            }

            const isPasswordValid = await bcrypt.compare(password, admin.password);

            if (!isPasswordValid) {
                return {
                    success: false,
                    message: 'Invalid email or password'
                };
            }

            admin.lastLogin = new Date();
            await admin.save();

            const token = jwt.sign(
                {
                    id:       admin._id,
                    adminId:  admin.adminId,       // ✅ Fixed: was admin.userId
                    email:    admin.email,
                    userName: admin.userName,
                    role:     admin.role,
                },
                JWT_SECRET,                        // ✅ Fixed: use shared constant
                { expiresIn: JWT_EXPIRES_IN }
            );

            const adminData = admin.toObject();
            delete adminData.password;

            return {
                success: true,
                message: 'Login successful',
                data: { admin: adminData, token }
            };

        } catch (error) {
            console.error('Error logging in:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // VERIFY TOKEN
    // ─────────────────────────────────────────
    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            const admin = await Admin.findById(decoded.id).select('-password');

            if (!admin) {
                return { success: false, message: 'Admin not found' };
            }

            return { success: true, data: admin };

        } catch (error) {
            // ✅ Fixed: distinguish token errors from server errors
            if (error.name === 'TokenExpiredError') {
                return { success: false, message: 'Token has expired' };
            }
            if (error.name === 'JsonWebTokenError') {
                return { success: false, message: 'Invalid token' };
            }
            console.error('Error verifying token:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ALL
    // ─────────────────────────────────────────
    async getAllAdmins() {
        try {
            const admins = await Admin.find().select('-password');
            return { success: true, data: admins };
        } catch (error) {
            console.error('Error fetching admins:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET BY ID
    // ─────────────────────────────────────────
    async getAdminById(adminId) {
        try {
            const admin = await Admin.findOne({ adminId }).select('-password');

            if (!admin) {
                return { success: false, message: 'Admin not found' };
            }

            return { success: true, data: admin };
        } catch (error) {
            console.error('Error fetching admin:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE
    // ─────────────────────────────────────────
    async updateAdmin(adminId, payload) {
        try {
            // Prevent updating sensitive fields directly
            const { password, adminId: _id, ...safePayload } = payload;

            const admin = await Admin.findOneAndUpdate(
                { adminId },
                safePayload,
                { new: true, runValidators: true }
            ).select('-password');

            if (!admin) {
                return { success: false, message: 'Admin not found' };
            }

            return { success: true, message: 'Admin updated successfully', data: admin };
        } catch (error) {
            console.error('Error updating admin:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────────
    async deleteAdmin(adminId) {
        try {
            const admin = await Admin.findOneAndDelete({ adminId });

            if (!admin) {
                return { success: false, message: 'Admin not found' };
            }

            return { success: true, message: 'Admin deleted successfully' };
        } catch (error) {
            console.error('Error deleting admin:', error);
            throw error;
        }
    }
}

module.exports = new AdminService();