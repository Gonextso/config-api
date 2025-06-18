import redis from 'redis';
import LogHelper from '../../helpers/LogHelper.js';
import ClientProvider from '../../cache/ClientProvider.js';
import CacheDatabases from '../../enums/CacheDatabases.js';

const logger = new LogHelper();

logger.info2('Building redis started');

ClientProvider.systemClient = redis.createClient({
    url: process.env.REDIS_URI,
    database: CacheDatabases.DB_NAMES.SystemCache
});

ClientProvider.nebimClient = redis.createClient({
    url: process.env.REDIS_URI,
    database: CacheDatabases.DB_NAMES.NebimCache
});

ClientProvider.shopifyClient = redis.createClient({
    url: process.env.REDIS_URI,
    database: CacheDatabases.DB_NAMES.ShopifyCache
});


ClientProvider.systemClient.on('error', (err) => {
    logger.error('Redis System Client error:', err);
    process.exit(1);
});

ClientProvider.nebimClient.on('error', (err) => {
    logger.error('Redis Nebim Client error:', err);
    process.exit(1);
});

ClientProvider.shopifyClient.on('error', (err) => {
    logger.error('Redis Shopify Client error:', err);
    process.exit(1);
});

ClientProvider.systemClient.connect().then(_ => logger.info4('Redis System Client Connected')); 
ClientProvider.nebimClient.connect().then(_ => logger.info4('Redis Nebim Client Connected')); 
ClientProvider.shopifyClient.connect().then(_ => logger.info4('Redis Shopify Client Connected')); 