import mongoose from 'mongoose';
import LogHelper from '../../helpers/LogHelper.js';

let logger = new LogHelper();

logger.info2('Building mongoose started');

// MongoDB connection is optional - only needed for migration
// Application will continue to work even if MongoDB connection fails
if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(_ => logger.info4('MongoDB Connected'))
        .catch(err => {
            logger.warn(`MongoDB connection failed (optional - only needed for migration): ${err.message}`);
            logger.warn('Application will continue without MongoDB connection');
        });
} else {
    logger.warn('MONGO_URI not set - MongoDB connection skipped (optional - only needed for migration)');
}