/**
 * MongoDB Connection Module
 * Connects to MongoDB using Mongoose. Falls back gracefully if DB is unavailable.
 */

const mongoose = require('mongoose');
const { logger } = require('./middleware/logger');

async function connectDB() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/affordmed_notifications';
    try {
        await mongoose.connect(uri);
        logger.info('Connected to MongoDB successfully', { uri });
        return true;
    } catch (err) {
        logger.warn('MongoDB connection failed — running without database', { error: err.message });
        return false;
    }
}

module.exports = { connectDB };
