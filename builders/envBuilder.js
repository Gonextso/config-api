import env from 'dotenv';
import LogHelper from '../helpers/LogHelper.js';

let logger = new LogHelper();

logger.info2('Building environment started');

env.config();