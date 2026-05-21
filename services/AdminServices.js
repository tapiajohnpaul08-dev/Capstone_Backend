const Admin = require("../models/Admin.Model");
const Customer = require("../models/Customer.Model"); // ✅ Add this import
const generateId = require("../utils/generateId");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "24h";

class AdminService {
  // ─────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────
  async createAdmin(payload) {
    try {
      const existingAdmin = await Admin.findOne({
        $or: [
          { email: payload.email.toLowerCase() },
          { username: payload.username },
        ],
      });

      if (existingAdmin) {
        return {
          success: false,
          message: "An admin with this email or username already exists",
          data: existingAdmin,
        };
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(payload.password, salt);

      const newAdmin = new Admin({
        adminId: await generateId(),
        firstName: payload.firstName,
        middleName: payload.middleName || "",
        lastName: payload.lastName,
        username: payload.username,
        email: payload.email,
        password: hashedPassword,
        role: payload.role,
      });

      await newAdmin.save();

      const adminData = newAdmin.toObject();
      delete adminData.password;

      return {
        success: true,
        message: "Admin created successfully",
        data: adminData,
      };
    } catch (error) {
      console.error("Error creating admin:", error);
      throw error;
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
          message: "Invalid email or password",
        };
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: "Invalid email or password",
        };
      }

      admin.lastLogin = new Date();
      await admin.save();

      const token = jwt.sign(
        {
          id: admin._id.toString(),
          adminId: admin.adminId,
          email: admin.email,
          userName: admin.userName,
          role: admin.role,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );

      const adminData = admin.toObject();
      delete adminData.password;

      return {
        success: true,
        message: "Login successful",
        data: { admin: adminData, token },
      };
    } catch (error) {
      console.error("Error logging in:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // VERIFY TOKEN
  // ─────────────────────────────────────────
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log("Decoded token:", decoded.adminId);
      const admin = await Admin.findById(decoded.id).select("-password");

      if (!admin) {
        return { success: false, message: "Admin not found" };
      }

      return { success: true, data: admin };
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

  // ─────────────────────────────────────────
  // GET ALL CUSTOMERS (Fixed - now uses Customer model)
  // ─────────────────────────────────────────
  async getAllCustomers() {
    try {
      const customers = await Customer.find().select("-password");
      console.log("Found customers:", customers.length);
      return { success: true, data: customers };
    } catch (error) {
      console.error("Error fetching customers:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET CUSTOMER BY ID (Added)
  // ─────────────────────────────────────────
  async getCustomerById(customerId) {
    try {
      const customer = await Customer.findOne({ customerId }).select(
        "-password",
      );

      if (!customer) {
        return { success: false, message: "Customer not found" };
      }

      return { success: true, data: customer };
    } catch (error) {
      console.error("Error fetching customer:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // DELETE CUSTOMER (Added)
  // ─────────────────────────────────────────
  async deleteCustomer(customerId) {
    try {
      const customer = await Customer.findOneAndDelete({ customerId });

      if (!customer) {
        return { success: false, message: "Customer not found" };
      }

      return { success: true, message: "Customer deleted successfully" };
    } catch (error) {
      console.error("Error deleting customer:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ALL ADMINS
  // ─────────────────────────────────────────
  async getAllAdmins() {
    try {
      const admins = await Admin.find().select("-password");
      return { success: true, data: admins };
    } catch (error) {
      console.error("Error fetching admins:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // GET ADMIN BY ID
  // ─────────────────────────────────────────
  async getAdminById(adminId) {
    try {
      const admin = await Admin.findOne({ adminId }).select("-password");

      if (!admin) {
        return { success: false, message: "User Admin not found" };
      }

      return { success: true, data: admin };
    } catch (error) {
      console.error("Error fetching admin:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // UPDATE ADMIN
  // ─────────────────────────────────────────
  async updateAdmin(adminId, payload) {
    try {
      const { password, adminId: _id, ...safePayload } = payload;

      const admin = await Admin.findOneAndUpdate({ adminId }, safePayload, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!admin) {
        return { success: false, message: "Admin not found" };
      }

      return {
        success: true,
        message: "Admin updated successfully",
        data: admin,
      };
    } catch (error) {
      console.error("Error updating admin:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────
  // DELETE ADMIN
  // ─────────────────────────────────────────
  async deleteAdmin(adminId, token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      const currentAdmin = await Admin.findById(decoded.id).select("-password");

      if (currentAdmin && currentAdmin.adminId === adminId) {
        return {
          success: false,
          message: "Admins cannot delete their own account",
        };
      }

      if (!currentAdmin) {
        const admin = await Admin.findOneAndDelete({ adminId });
      }
      if (!admin) {
        return { success: false, message: "Admin not found" };
      }

      return { success: true, message: "Admin deleted successfully" };
    } catch (error) {
      console.error("Error deleting admin:", error);
      throw error;
    }
  }
}

module.exports = new AdminService();
