// services/DriverService.js
const Driver = require('../models/Driver.Model');
const bcrypt = require("bcrypt");
const generateId = require('../utils/generateId');

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "24h";
class DriverService {
    
    // Create a new driver
    async createDriver(driverData) {
        try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(driverData.password, salt);

            const driver = new Driver({
                driverId: await generateId('DRV'),
                firstName: driverData.firstName,
                middleName: driverData.middleName || '',
                lastName: driverData.lastName,
                username: driverData.username,
                email: driverData.email,
                phoneNumber: driverData.phoneNumber,
                password: hashedPassword,
                plateNumber: driverData.plateNumber,
                vehicleDescription: driverData.vehicleDescription || '',
                available: driverData.available !== undefined ? driverData.available : true,
                assignedOrdersCount: 0
            });

            await driver.save();
            
            const driverResponse = driver.toJSON();
            delete driverResponse.password;
            
            return {
                success: true,
                message: 'Driver created successfully',
                data: driverResponse
            };
        } catch (error) {
            console.error('Error creating driver:', error);
            throw error;
        }
    }

      // ─────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────
  async login(payload) {
    try {
      const { email, password } = payload;

      const driver = await Driver.findOne({ email: email.toLowerCase() });

      if (!driver) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      const isPasswordValid = await bcrypt.compare(password, driver.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      driver.lastLogin = new Date();
      await driver.save();

      const token = jwt.sign(
        {
          id: driver._id.toString(),
          driverId: driver.driverId,
          email: driver.email,
          userName: driver.username,
          role: 'driver',
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );

      const driverData = driver.toObject();
      delete driverData.password;

      return {
        success: true,
        message: "Login successful",
        data: { driver: driverData, token },
      };
    } catch (error) {
      console.error("Error logging in:", error);
      throw error;
    }
  }

  async verifyToken(token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log("Decoded token:", decoded.driverId);
        const driver = await Driver.findById(decoded.id).select("-password");
  
        if (!driver) {
          return { success: false, message: "Driver not found" };
        }
  
        return { success: true, data: driver };
      } catch (error) {
        if (error.name === "TokenExpiredError") {
          return { success: false, message: "Token has expired" };
        }
        if (error.name === "JsonWebTokenError") {
          return { success: false, message: "Invalid token" };
        }
        console.error("Error verifying token:", error);
        throw error;
      }
    }
    
    // Get all drivers
    async getAllDrivers(filters = {}) {
        try {
            const query = {};
            
            if (filters.available !== undefined) {
                query.available = filters.available === 'true';
            }
            if (filters.search) {
                const searchRegex = new RegExp(filters.search, 'i');
                query.$or = [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { username: searchRegex },
                    { email: searchRegex },
                    { plateNumber: searchRegex }
                ];
            }

            const drivers = await Driver.find(query)
                .select('-password')
                .sort({ createdAt: -1 });

            return {
                success: true,
                data: drivers,
                count: drivers.length
            };
        } catch (error) {
            console.error('Error fetching drivers:', error);
            throw error;
        }
    }

    // Get available drivers (for assignment)
    async getAvailableDrivers() {
        try {
            // Only return drivers who are marked as available
            const drivers = await Driver.find({ 
                available: true
            })
            .select('-password')
            .sort({ firstName: 1 });

            console.log(`📦 Found ${drivers.length} available drivers`);

            return {
                success: true,
                data: drivers,
                count: drivers.length
            };
        } catch (error) {
            console.error('Error fetching available drivers:', error);
            return {
                success: false,
                message: error.message,
                data: []
            };
        }
    }

    // Get driver by ID
    async getDriverById(driverId) {
        try {
            const driver = await Driver.findOne({ driverId }).select('-password');
            
            if (!driver) {
                return { success: false, message: 'Driver not found' };
            }

            return {
                success: true,
                data: driver
            };
        } catch (error) {
            console.error('Error fetching driver:', error);
            throw error;
        }
    }

    // Get driver by email (for login)
    async getDriverByEmail(email) {
        try {
            const driver = await Driver.findOne({ email });
            return driver;
        } catch (error) {
            console.error('Error fetching driver by email:', error);
            throw error;
        }
    }

    // Update driver
    async updateDriver(driverId, updateData) {
        try {
            const driver = await Driver.findOne({ driverId });
            
            if (!driver) {
                return { success: false, message: 'Driver not found' };
            }

            const allowedUpdates = [
                'firstName', 'middleName', 'lastName', 
                'username', 'email', 'phoneNumber',
                'plateNumber', 'vehicleDescription', 'available'
            ];

            allowedUpdates.forEach(field => {
                if (updateData[field] !== undefined) {
                    driver[field] = updateData[field];
                }
            });

            if (updateData.password) {
                const salt = await bcrypt.genSalt(10);
                driver.password = await bcrypt.hash(updateData.password, salt);
            }

            driver.updatedAt = new Date();
            await driver.save();

            const driverResponse = driver.toJSON();
            delete driverResponse.password;

            return {
                success: true,
                message: 'Driver updated successfully',
                data: driverResponse
            };
        } catch (error) {
            console.error('Error updating driver:', error);
            throw error;
        }
    }

    // Delete driver
    async deleteDriver(driverId) {
        try {
            const driver = await Driver.findOneAndDelete({ driverId });
            
            if (!driver) {
                return { success: false, message: 'Driver not found' };
            }

            return {
                success: true,
                message: 'Driver deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting driver:', error);
            throw error;
        }
    }

    // Increment assigned orders count
    async incrementAssignedOrders(driverId) {
        try {
            const driver = await Driver.findOne({ driverId });
            
            if (!driver) {
                return { success: false, message: 'Driver not found' };
            }

            if (!driver.available) {
                return { success: false, message: 'Driver is not available' };
            }

            driver.assignedOrdersCount += 1;
            driver.updatedAt = new Date();
            await driver.save();

            console.log(`📦 Incremented assigned orders for driver ${driverId}. New count: ${driver.assignedOrdersCount}`);

            return {
                success: true,
                message: 'Assigned orders count incremented',
                data: driver
            };
        } catch (error) {
            console.error('Error incrementing assigned orders:', error);
            throw error;
        }
    }

    // Decrement assigned orders count
    async decrementAssignedOrders(driverId) {
        try {
            const driver = await Driver.findOne({ driverId });
            
            if (!driver) {
                return { success: false, message: 'Driver not found' };
            }

            driver.assignedOrdersCount = Math.max(0, driver.assignedOrdersCount - 1);
            driver.updatedAt = new Date();
            await driver.save();

            return {
                success: true,
                message: 'Assigned orders count decremented',
                data: driver
            };
        } catch (error) {
            console.error('Error decrementing assigned orders:', error);
            throw error;
        }
    }

    // Toggle driver availability (admin only)
    async toggleAvailability(driverId) {
        try {
            const driver = await Driver.findOne({ driverId });
            
            if (!driver) {
                return { success: false, message: 'Driver not found' };
            }

            driver.available = !driver.available;
            driver.updatedAt = new Date();
            await driver.save();

            const driverResponse = driver.toJSON();
            delete driverResponse.password;

            return {
                success: true,
                message: `Driver ${driver.available ? 'available' : 'unavailable'}`,
                data: driverResponse
            };
        } catch (error) {
            console.error('Error toggling driver availability:', error);
            throw error;
        }
    }

    // Get driver statistics
    async getDriverStats() {
        try {
            const totalDrivers = await Driver.countDocuments();
            const availableDrivers = await Driver.countDocuments({ available: true });
            const unavailableDrivers = await Driver.countDocuments({ available: false });

            return {
                success: true,
                data: {
                    totalDrivers,
                    availableDrivers,
                    unavailableDrivers
                }
            };
        } catch (error) {
            console.error('Error getting driver stats:', error);
            throw error;
        }
    }

    // Update last login
    async updateLastLogin(driverId) {
        try {
            const driver = await Driver.findOne({ driverId });
            if (driver) {
                driver.lastLogin = new Date();
                driver.updatedAt = new Date();
                await driver.save();
                return { success: true };
            }
            return { success: false, message: 'Driver not found' };
        } catch (error) {
            console.error('Error updating last login:', error);
            throw error;
        }
    }


// Get driver by email (for login) - Add this method
async getDriverByEmail(email) {
    try {
        const driver = await Driver.findOne({ email });
        return driver;
    } catch (error) {
        console.error('Error fetching driver by email:', error);
        throw error;
    }
}

// Update last login - Add this method
async updateLastLogin(driverId) {
    try {
        const driver = await Driver.findOne({ driverId });
        if (driver) {
            driver.lastLogin = new Date();
            driver.updatedAt = new Date();
            await driver.save();
            return { success: true };
        }
        return { success: false, message: 'Driver not found' };
    } catch (error) {
        console.error('Error updating last login:', error);
        throw error;
    }
}

// Get driver with assigned orders count - Add this method
async getDriverWithOrderCount(driverId) {
    try {
        const driver = await Driver.findOne({ driverId }).select('-password');
        if (!driver) {
            return { success: false, message: 'Driver not found' };
        }
        
        // Get assigned orders count from Order model
        const Order = require('../models/Order.Model');
        const assignedCount = await Order.countDocuments({
            'driverDetails.driverId': driverId,
            status: { $in: ['Out for Delivery', 'Scheduled'] }
        });
        
        const driverData = driver.toJSON();
        driverData.activeOrders = assignedCount;
        
        return {
            success: true,
            data: driverData
        };
    } catch (error) {
        console.error('Error fetching driver with order count:', error);
        throw error;
    }
}

// Get driver statistics with order counts - Add this method
async getDriverStatsWithOrders() {
    try {
        const totalDrivers = await Driver.countDocuments();
        const availableDrivers = await Driver.countDocuments({ available: true });
        const unavailableDrivers = await Driver.countDocuments({ available: false });
        
        // Get drivers with active orders
        const Order = require('../models/Order.Model');
        const driversWithActiveOrders = await Order.distinct('driverDetails.driverId', {
            status: { $in: ['Out for Delivery', 'Scheduled'] }
        });
        
        return {
            success: true,
            data: {
                totalDrivers,
                availableDrivers,
                unavailableDrivers,
                driversWithActiveOrders: driversWithActiveOrders.length
            }
        };
    } catch (error) {
        console.error('Error getting driver stats with orders:', error);
        throw error;
    }
}


}

module.exports = new DriverService();