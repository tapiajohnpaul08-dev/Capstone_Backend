const RawMaterial = require('../models/RawMaterial_Model');
const generateId = require('../utils/generateId');

class RawMaterialService {

    // ─────────────────────────────────────────
    // CREATE
    // ─────────────────────────────────────────
    async createRawMaterial(payload) {
        try {
            const existingMaterial = await RawMaterial.findOne({ name: payload.name, category: payload.category });

            if (existingMaterial) {
                return {
                    success: false,
                    message: 'A raw material with this name already exists in the same category'
                };
            }

            const newMaterial = new RawMaterial({
                materialId:        await generateId(),
                name:              payload.name,
                description:       payload.description || '',
                category:          payload.category,
                unit:              payload.unit,
                stock:             payload.stock || 0,
                costPerUnit:       payload.costPerUnit,
                lowStockThreshold: payload.lowStockThreshold || 10,
            });

            await newMaterial.save();

            return {
                success: true,
                message: 'Raw material created successfully',
                data: newMaterial
            };

        } catch (error) {
            console.error('Error creating raw material:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET ALL
    // ─────────────────────────────────────────
    async getAllRawMaterials() {
        try {
            const materials = await RawMaterial.find();
            return { success: true, data: materials };
        } catch (error) {
            console.error('Error fetching raw materials:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET BY ID
    // ─────────────────────────────────────────
    async getRawMaterialById(materialId) {
        try {
            const material = await RawMaterial.findOne({ materialId });

            if (!material) {
                return { success: false, message: 'Raw material not found' };
            }

            return { success: true, data: material };
        } catch (error) {
            console.error('Error fetching raw material:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET BY CATEGORY
    // ─────────────────────────────────────────
    async getRawMaterialsByCategory(category) {
        try {
            const materials = await RawMaterial.find({ category });

            if (!materials.length) {
                return { success: false, message: 'No raw materials found in this category' };
            }

            return { success: true, data: materials };
        } catch (error) {
            console.error('Error fetching raw materials by category:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // GET LOW STOCK
    // ─────────────────────────────────────────
    async getLowStockMaterials() {
        try {
            const materials = await RawMaterial.find({
                $expr: { $lte: ['$stock', '$lowStockThreshold'] }
            });

            return { success: true, data: materials };
        } catch (error) {
            console.error('Error fetching low stock materials:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // ADD STOCK
    // ─────────────────────────────────────────
    async addStock(materialId, quantity) {
        try {
            if (quantity <= 0) {
                return { success: false, message: 'Quantity must be greater than 0' };
            }

            const material = await RawMaterial.findOne({ materialId });

            if (!material) {
                return { success: false, message: 'Raw material not found' };
            }

            material.stock += quantity;
            await material.save();

            return {
                success: true,
                message: `Added ${quantity} ${material.unit} to stock`,
                data: material
            };

        } catch (error) {
            console.error('Error adding stock:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DEDUCT STOCK
    // ─────────────────────────────────────────
    async deductStock(materialId, quantity) {
        try {
            if (quantity <= 0) {
                return { success: false, message: 'Quantity must be greater than 0' };
            }

            const material = await RawMaterial.findOne({ materialId });

            if (!material) {
                return { success: false, message: 'Raw material not found' };
            }

            if (material.stock < quantity) {
                return {
                    success: false,
                    message: `Insufficient stock. Available: ${material.stock}, Requested: ${quantity}`
                };
            }

            material.stock -= quantity;
            await material.save();

            return {
                success: true,
                message: `Deducted ${quantity} ${material.unit} from stock`,
                data: material
            };

        } catch (error) {
            console.error('Error deducting stock:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // UPDATE
    // ─────────────────────────────────────────
    async updateRawMaterial(materialId, payload) {
        try {
            const { materialId: _id, ...safePayload } = payload;

            const material = await RawMaterial.findOneAndUpdate(
                { materialId },
                safePayload,
                { new: true, runValidators: true }
            );

            if (!material) {
                return { success: false, message: 'Raw material not found' };
            }

            return {
                success: true,
                message: 'Raw material updated successfully',
                data: material
            };

        } catch (error) {
            console.error('Error updating raw material:', error);
            throw error;
        }
    }

    // ─────────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────────
    async deleteRawMaterial(materialId) {
        try {
            const material = await RawMaterial.findOneAndDelete({ materialId });

            if (!material) {
                return { success: false, message: 'Raw material not found' };
            }

            return { success: true, message: 'Raw material deleted successfully' };

        } catch (error) {
            console.error('Error deleting raw material:', error);
            throw error;
        }
    }
}

module.exports = new RawMaterialService();