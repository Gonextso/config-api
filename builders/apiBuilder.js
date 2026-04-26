import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import ErrorController from '../controllers/ErrorController.js';
import healthRouter  from '../routes/health.js' ;
import shopifyAuthRouter from '../routes/shopify/auth.js';
import shopifyBillingRouter from '../routes/shopify/billing.js';
import adminRouter  from '../routes/admin.js';
import tenantRouter from '../routes/tenant.js';
import proxyRouter from '../routes/proxy.js';
import RequestMiddleware from '../middlewares/RequestMiddleware.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';
import LogHelper from '../helpers/LogHelper.js';
import shopifyGdprRouter from '../routes/shopify/gdpr.js';
import shopifyShopRouter from '../routes/shopify/shop.js';

let logger = new LogHelper();

logger.info2('Building Express API started');

const app = express();
const routePrefix = `/rest/${process.env.API_TYPE}/${process.env.VERSION}`;
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser calls (curl, server-to-server) and configured browser origins.
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
};

app.use(helmet());
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan(function (tokens, req, res) {
    if (req.tenant) logger = new LogHelper(req.tenant);

    return logger.request([
        `${tokens['remote-addr'](req, res)} - ${tokens['remote-user'](req, res) ?? "no_user"}`,
        `[${new Date(tokens.date(req, res)).toISOString()}]`,
        `"${tokens.method(req, res)}`,
        tokens.url(req, res),
        `HTTP/${tokens['http-version'](req, res)}"`,
        tokens.status(req, res),
        `${tokens.res(req, res, 'content-length')}-`,
        `${tokens['response-time'](req, res)}ms`,
        tokens['user-agent'](req, res)
    ].join(' '));
}));

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.set('json spaces', 2);
app.use((_, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    next();
});
app.use(RequestMiddleware.setTraceId);

app.use(`${routePrefix}/health`, healthRouter);
app.use(`${routePrefix}/admin`, AuthMiddleware.isAdmin ,adminRouter);
app.use(`${routePrefix}/shopify/auth`, shopifyAuthRouter);
app.use(`${routePrefix}/shopify/webhooks/gdpr`, shopifyGdprRouter);
app.use(`${routePrefix}/shopify/webhooks/billing`, shopifyBillingRouter);
app.use(`${routePrefix}/shopify/webhooks/shop`, shopifyShopRouter);
app.use(`${routePrefix}/tenant`, AuthMiddleware.isShopifyAuthenticated, tenantRouter);
app.use(`${routePrefix}/proxy`, AuthMiddleware.isShopifyAuthenticated, proxyRouter);

app.use('/', ErrorController.notFound);
app.use(ErrorController.errorHandler);

if (!process.env.PORT) process.exit(1);

app.listen(process.env.PORT, '::'); 

logger.info4(`Listening on port ${process.env.PORT} for environment '${process.env.ENV ? process.env.ENV : "PROD"}'. API type: ${process.env.API_TYPE} - Version: ${process.env.VERSION}`);


