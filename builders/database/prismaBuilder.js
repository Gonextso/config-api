import { PrismaClient } from '@prisma/client';
import LogHelper from '../../helpers/LogHelper.js';

let logger = new LogHelper();

logger.info2('Building Prisma started');

// Determine log level based on environment
const isQueryLoggingEnabled = process.env.PRISMA_LOG_QUERIES === 'true' || process.env.NODE_ENV === 'development';

// Prisma 6: Standard PrismaClient configuration
const prisma = new PrismaClient({
  log: isQueryLoggingEnabled
    ? [
        { emit: 'event', level: 'query' },
        'error',
        'warn',
      ]
    : ['error'],
});

// Query profiling - log all queries with details
if (isQueryLoggingEnabled) {
  prisma.$on('query', (e) => {
    const queryInfo = {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
      target: e.target,
    };

    // Log slow queries with warning
    if (e.duration > 1000) {
      logger.warn(`[Prisma Slow Query] Duration: ${e.duration}ms`);
      logger.warn(`[Prisma Query] ${e.query}`);
      logger.warn(`[Prisma Params] ${e.params}`);
    } else {
      logger.info3(`[Prisma Query] ${e.query}`);
      logger.info3(`[Prisma Duration] ${e.duration}ms`);
      if (e.params && e.params !== '[]') {
        logger.info3(`[Prisma Params] ${e.params}`);
      }
    }
  });
}

// Test connection
prisma.$connect()
    .then(_ => {
        logger.info4('PostgreSQL Connected via Prisma');
        if (isQueryLoggingEnabled) {
          logger.info4('Prisma Query Profiling Enabled');
        }
    })
    .catch(err => {
        logger.error(err);
        process.exit(1);
    });

// Export prisma client instance
export default prisma;

