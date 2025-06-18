import mongoose from 'mongoose';
import LogHelper from '../../helpers/LogHelper.js';

let logger = new LogHelper();

logger.info2('Building mongoose started');

mongoose.connect(process.env.MONGO_URI)
    .then(_ => logger.info4('MongoDB Connected'))
    .catch(err => {
        logger.error(err);
        process.exit(1);
    });