const express = require('express');
const router = express.Router();
const AdminController = require('../controller/AdminController');
const { verifyAdminToken, checkRole } = require('../middleware/authMiddleware');

// ─────────────────────────────────────────
// PUBLIC ROUTES (no token required)
// ─────────────────────────────────────────
router.post('/register', AdminController.createAdmin);
router.post('/login',    AdminController.login);
router.get('/verify',    AdminController.verifyToken);

// ─────────────────────────────────────────
// ADMIN MANAGEMENT ROUTES (admin manages admins)
// ─────────────────────────────────────────
router.get('/allAdmins',          verifyAdminToken, AdminController.getAllAdmins); 
router.get('/admin/:adminId',     verifyAdminToken, AdminController.getAdminById); 
router.put('/admin/:adminId',     verifyAdminToken, AdminController.updateAdmin);

router.delete('/admin/:adminId',  verifyAdminToken, checkRole('Sales'), AdminController.deleteAdmin);

// ─────────────────────────────────────────
// CUSTOMER MANAGEMENT ROUTES (admin manages customers)
// ─────────────────────────────────────────
router.get('/allCustomers',               verifyAdminToken, AdminController.getAllCustomers);
router.get('/customer/:customerId',       verifyAdminToken, AdminController.getCustomerById);
router.delete('/customer/:customerId',    verifyAdminToken, AdminController.deleteCustomer);

router.get('/debug/low-stock-check', verifyAdminToken, async (req, res) => {
  try {
    // Get all products with their stock
    const products = await Product.find({});
    const lowStockProducts = products.filter(p => {
      const totalStock = p.sizes.reduce((sum, s) => sum + (s.stock || 0), 0);
      return totalStock > 0 && totalStock < 100;
    });
    
    // Get supplies from inventory
    const supplies = await InventoryItem.find({ itemType: 'supply' }).populate('itemRef');
    const lowStockSupplies = supplies.filter(s => s.stock > 0 && s.stock <= (s.threshold || 100));
    
    res.json({
      success: true,
      data: {
        lowStockProducts: lowStockProducts.map(p => ({
          name: p.name,
          totalStock: p.sizes.reduce((sum, s) => sum + (s.stock || 0), 0),
          sizes: p.sizes.map(s => ({ name: s.name, stock: s.stock }))
        })),
        lowStockSupplies: lowStockSupplies.map(s => ({
          name: s.itemRef?.name || 'Unknown',
          stock: s.stock,
          threshold: s.threshold
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;