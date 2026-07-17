// scripts/fixCustomerTemplateIndex.js

const mongoose = require('mongoose');
require('dotenv').config();

async function fixCustomerTemplateIndex() {
    try {
        // Connect to MongoDB using your connection string
        const mongoURI = process.env.MONGO_DB_ONLINE || process.env.MONGO_DB_LOCAL || 'mongodb://localhost:27017/test';
        await mongoose.connect(mongoURI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        console.log('📋 Available collections:', collectionNames);

        // Check if customers collection exists
        if (!collectionNames.includes('customers')) {
            console.log('ℹ️ Customers collection does not exist yet. Creating it...');
            // Create the collection with proper indexes
            await db.createCollection('customers');
            console.log('✅ Created customers collection');
        }

        const collection = db.collection('customers');
        
        // Get all existing indexes
        let indexes = [];
        try {
            indexes = await collection.indexes();
            console.log('📋 Current indexes:', indexes.map(i => i.name));
        } catch (error) {
            if (error.code === 26) {
                console.log('ℹ️ No indexes found, creating new ones...');
            } else {
                throw error;
            }
        }

        // Drop the problematic index if it exists
        const problematicIndex = indexes.find(i => i.name === 'templateDesigns.templateId_1');
        if (problematicIndex) {
            try {
                await collection.dropIndex('templateDesigns.templateId_1');
                console.log('✅ Dropped problematic index: templateDesigns.templateId_1');
            } catch (error) {
                console.log('ℹ️ Index already dropped or does not exist');
            }
        }

        // Create new proper index
        try {
            await collection.createIndex(
                { 'templateDesigns.templateId': 1 },
                { 
                    unique: true, 
                    sparse: true,
                    partialFilterExpression: { 
                        'templateDesigns.templateId': { $exists: true, $ne: null } 
                    }
                }
            );
            console.log('✅ Created new sparse unique index on templateDesigns.templateId');
        } catch (error) {
            if (error.code === 85) {
                console.log('ℹ️ Index already exists with different options, skipping...');
            } else {
                throw error;
            }
        }

        // Create other necessary indexes if they don't exist
        const requiredIndexes = [
            { key: { customerId: 1 }, options: { unique: true } },
            { key: { email: 1 }, options: { unique: true } },
            { key: { username: 1 }, options: { unique: true } },
            { key: { providerId: 1 }, options: { unique: true, sparse: true } }
        ];

        for (const index of requiredIndexes) {
            try {
                await collection.createIndex(index.key, index.options);
                console.log(`✅ Created index on ${Object.keys(index.key).join(', ')}`);
            } catch (error) {
                if (error.code === 85) {
                    console.log(`ℹ️ Index on ${Object.keys(index.key).join(', ')} already exists`);
                } else {
                    console.error(`❌ Failed to create index on ${Object.keys(index.key).join(', ')}:`, error.message);
                }
            }
        }

        // Clean up any documents with null templateId in templateDesigns
        try {
            const updateResult = await collection.updateMany(
                { 'templateDesigns.templateId': null },
                { $pull: { templateDesigns: { templateId: null } } }
            );
            console.log(`✅ Cleaned up ${updateResult.modifiedCount} documents with null templateId`);
        } catch (error) {
            console.log('ℹ️ No documents needed cleaning');
        }

        // Verify the final indexes
        const finalIndexes = await collection.indexes();
        console.log('📋 Final indexes:', finalIndexes.map(i => ({ name: i.name, key: i.key })));

        console.log('🎉 Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        console.error('Error details:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the migration
if (require.main === module) {
    fixCustomerTemplateIndex().catch(console.error);
}

module.exports = fixCustomerTemplateIndex;