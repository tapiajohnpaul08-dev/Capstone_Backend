const Customer = require('../models/Customer.Model');
const BlacklistToken = require('../models/BlacklistToken'); // Add this
const generateId = require('../utils/generateId');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { verifyOtp } = require('../utils/otpUtils'); // Add this import


const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

class CustomerService {

    // ─────────────────────────────────────────
    // REGISTER
    // ─────────────────────────────────────────
    // Update the register method to properly validate OTP
async register(payload, otp) {
    try {
        console.log('=== REGISTER DEBUG ===');
        console.log('Received payload:', JSON.stringify(payload, null, 2));
        console.log('Received OTP:', otp);
        
        // Check if OTP is provided
        if (!otp) {
            console.log('No OTP provided');
            return {
                success: false,
                message: 'OTP is required. Please request an OTP first.'
            };
        }
        
        // Verify OTP
        const otpVerification = await verifyOtp(payload.email, otp);
        console.log('OTP verification result:', otpVerification);
        
        if (!otpVerification.success) {
            return {
                success: false,
                message: otpVerification.message
            };
        }

        // Check if customer already exists
        const existingCustomer = await Customer.findOne({
            $or: [
                { email: payload.email.toLowerCase() },
                { username: payload.username }
            ]
        });

        if (existingCustomer) {
            console.log('Customer already exists:', existingCustomer.email);
            return {
                success: false,
                message: 'A customer with this email or username already exists'
            };
        }

        // Log the data being saved
        const customerData = {
            customerId: await generateId(),
            firstName: payload.firstName,
            middleName: payload.middleName || '',
            lastName: payload.lastName,
            username: payload.username,
            email: payload.email.toLowerCase(),
            phone: payload.phone || '',
            companyName: payload.companyName || null,
            password: await bcrypt.hash(payload.password, await bcrypt.genSalt(10))
        };
        
        console.log('Creating customer with data:', JSON.stringify(customerData, null, 2));

        const newCustomer = new Customer(customerData);
        await newCustomer.save();

        const savedCustomer = newCustomer.toObject();
        delete savedCustomer.password;

        return {
            success: true,
            message: 'Customer registered successfully',
            data: savedCustomer
        };

    } catch (error) {
        console.error('Error registering customer:', error);
        // Log the full error details
        if (error.code === 11000) {
            console.error('Duplicate key error:', error.keyPattern, error.keyValue);
        }
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
                    id: customer._id,
                    customerId: customer.customerId,
                    email: customer.email,
                    userName: customer.userName,
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

async logout(token) {
        try {
            if (!token) {
                return {
                    success: false,
                    message: 'No token provided'
                };
            }

            // Verify token to get expiry
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Add token to blacklist
            await BlacklistToken.create({
                token: token,
                expiresAt: new Date(decoded.exp * 1000) // Convert to milliseconds
            });

            console.log('Token blacklisted successfully');

            return {
                success: true,
                message: 'Logged out successfully'
            };
            
        } catch (error) {
            console.error('Error during logout:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // VERIFY TOKEN
    // ─────────────────────────────────────────
     async verifyToken(token) {
        try {
            if (!token) {
                return { success: false, message: 'No token provided' };
            }

            // Check if token is blacklisted
            const isBlacklisted = await BlacklistToken.findOne({ token });
            
            if (isBlacklisted) {
                return { 
                    success: false, 
                    message: 'Token has been invalidated. Please login again.' 
                };
            }

            // Verify JWT token
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