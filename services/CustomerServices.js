const Customer = require('../models/Customer.Model');
const generateId = require('../utils/generateId');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

class CustomerService {

    // ─────────────────────────────────────────
    // REGISTER
    // ─────────────────────────────────────────
    async register(payload) {
        try {
            const existingCustomer = await Customer.findOne({
                $or: [
                    { email: payload.email.toLowerCase() },
                    { userName: payload.userName }
                ]
            });

            if (existingCustomer) {
                return {
                    success: false,
                    message: 'A customer with this email or username already exists'
                };
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(payload.password, salt);

            const newCustomer = new Customer({
                customerId: await generateId(),
                firstName:  payload.firstName,
                middleName: payload.middleName || '',
                lastName:   payload.lastName,
                userName:   payload.userName,
                email:      payload.email,
                password:   hashedPassword,
            });

            await newCustomer.save();

            const customerData = newCustomer.toObject();
            delete customerData.password;

            return {
                success: true,
                message: 'Customer registered successfully',
                data: customerData
            };

        } catch (error) {
            console.error('Error registering customer:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────
    async login(payload) {
        try {
            const { email, password } = payload;

            const customer = await Customer.findOne({ email: email.toLowerCase() });

            if (!customer) {
                return {
                    success: false,
                    message: 'Invalid email or password'
                };
            }

            const isPasswordValid = await bcrypt.compare(password, customer.password);

            if (!isPasswordValid) {
                return {
                    success: false,
                    message: 'Invalid email or password'
                };
            }

            const token = jwt.sign(
                {
                    id:         customer._id,
                    customerId: customer.customerId,
                    email:      customer.email,
                    userName:   customer.userName,
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            const customerData = customer.toObject();
            delete customerData.password;

            return {
                success: true,
                message: 'Login successful',
                data: { customer: customerData, token }
            };

        } catch (error) {
            console.error('Error logging in customer:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // VERIFY TOKEN
    // ─────────────────────────────────────────
    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            const customer = await Customer.findById(decoded.id).select('-password');

            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            return { success: true, data: customer };

        } catch (error) {
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
    async getAllCustomers() {
        try {
            const customers = await Customer.find().select('-password');
            return { success: true, data: customers };
        } catch (error) {
            console.error('Error fetching customers:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET BY ID
    // ─────────────────────────────────────────
    async getCustomerById(customerId) {
        try {
            const customer = await Customer.findOne({ customerId }).select('-password');

            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            return { success: true, data: customer };
        } catch (error) {
            console.error('Error fetching customer:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE
    // ─────────────────────────────────────────
    async updateCustomer(customerId, payload) {
        try {
            // Prevent updating sensitive fields directly
            const { password, customerId: _id, ...safePayload } = payload;

            const customer = await Customer.findOneAndUpdate(
                { customerId },
                safePayload,
                { new: true, runValidators: true }
            ).select('-password');

            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            return {
                success: true,
                message: 'Customer updated successfully',
                data: customer
            };

        } catch (error) {
            console.error('Error updating customer:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // CHANGE PASSWORD
    // ─────────────────────────────────────────
    async changePassword(customerId, payload) {
        try {
            const { currentPassword, newPassword } = payload;

            const customer = await Customer.findOne({ customerId });

            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, customer.password);

            if (!isPasswordValid) {
                return { success: false, message: 'Current password is incorrect' };
            }

            const salt = await bcrypt.genSalt(10);
            customer.password = await bcrypt.hash(newPassword, salt);
            await customer.save();

            return { success: true, message: 'Password changed successfully' };

        } catch (error) {
            console.error('Error changing password:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────────
    async deleteCustomer(customerId) {
        try {
            const customer = await Customer.findOneAndDelete({ customerId });

            if (!customer) {
                return { success: false, message: 'Customer not found' };
            }

            return { success: true, message: 'Customer deleted successfully' };

        } catch (error) {
            console.error('Error deleting customer:', error);
            throw error;
        }
    }
}

module.exports = new CustomerService();