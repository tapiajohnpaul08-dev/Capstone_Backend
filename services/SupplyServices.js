// services/SupplyService.js
const Supply = require('../models/Supply.Model');
const generateId = require('../utils/generateItemId');

class SupplyService {

     async createSupply(payload) {
        try {
            const existingSupply = await Supply.findOne({ 
                name: payload.name,
                category: payload.category
            });

            if (existingSupply) {
                return {
                    success: false,
                    message: 'A supply with this name already exists in this category'
                };
            }

            // Generate ID
            const supplyId = await generateId('SUP', 3);
            
            const newSupply = new Supply({
                supplyId: supplyId,
                name: payload.name,
                category: payload.category,
                description: payload.description || '',
                image: payload.image || '',
                supplier: payload.supplier,
                supplierContact: payload.supplierContact || '',
                leadTime: payload.leadTime || 7,
                unit: payload.unit || 'piece',
                minOrderQuantity: payload.minOrderQuantity || 1,
                unitCost: payload.unitCost || 0,
                isActive: payload.isActive !== undefined ? payload.isActive : true
            });

            await newSupply.save();

            console.log('New supply created:', newSupply); // ✅ Move this BEFORE return

            return {
                success: true,
                message: 'Supply created successfully',
                data: newSupply
            };

        } catch (error) {
            console.error('Error creating supply:', error);
            throw error;
        }
    }

    async getAllSupplies() {
        try {
            const supplies = await Supply.find().sort({ category: 1, name: 1 });
            return { success: true, data: supplies };
        } catch (error) {
            console.error('Error fetching supplies:', error);
            throw error;
        }
    }

    async getSupplyById(supplyId) {
        try {
            const supply = await Supply.findOne({ supplyId });
            
            if (!supply) {
                return { success: false, message: 'Supply not found' };
            }
            
            return { success: true, data: supply };
        } catch (error) {
            console.error('Error fetching supply:', error);
            throw error;
        }
    }

    async getSuppliesByCategory(category) {
        try {
            const supplies = await Supply.find({ category });
            return { success: true, data: supplies };
        } catch (error) {
            console.error('Error fetching supplies by category:', error);
            throw error;
        }
    }

    async updateSupply(supplyId, payload) {
        try {
            const { supplyId: _id, ...updateData } = payload;
            updateData.updatedAt = new Date();

            const supply = await Supply.findOneAndUpdate(
                { supplyId },
                updateData,
                { new: true, runValidators: true }
            );

            if (!supply) {
                return { success: false, message: 'Supply not found' };
            }

            return {
                success: true,
                message: 'Supply updated successfully',
                data: supply
            };

        } catch (error) {
            console.error('Error updating supply:', error);
            throw error;
        }
    }

    async deleteSupply(supplyId) {
        try {
            const supply = await Supply.findOneAndDelete({ supplyId });

            if (!supply) {
                return { success: false, message: 'Supply not found' };
            }

            return { success: true, message: 'Supply deleted successfully' };
        } catch (error) {
            console.error('Error deleting supply:', error);
            throw error;
        }
    }

    async getActiveSupplies() {
        try {
            const supplies = await Supply.find({ isActive: true }).sort({ name: 1 });
            return { success: true, data: supplies };
        } catch (error) {
            console.error('Error fetching active supplies:', error);
            throw error;
        }
    }
}

module.exports = new SupplyService();