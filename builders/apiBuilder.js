import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import ErrorController from '../controllers/ErrorController.js';
import healthRouter  from '../routes/health.js' ;
import shopifyAuthRouter from '../routes/shopify/auth.js';
import billingRouter from '../routes/billing.js';
import adminRouter  from '../routes/admin.js';
import tenantRouter from '../routes/tenant.js';
import supportRouter from '../routes/supportRouter.js';
import proxyRouter from '../routes/proxy.js';
import RequestMiddleware from '../middlewares/RequestMiddleware.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';
import LogHelper from '../helpers/LogHelper.js';
import ConfigMiddleware from '../middlewares/ConfigMiddleware.js';

let logger = new LogHelper();

logger.info2('Building Express API started');

const app = express();
const routePrefix = `/rest/${process.env.API_TYPE}/${process.env.VERSION}`;

app.use(helmet());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
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

app.use(cors());
app.use(express.json());
app.set('json spaces', 2);
app.use((_, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Header', 'Content-Type, Authorization');
    next();
});
app.use(RequestMiddleware.setTraceId);

app.use(`${routePrefix}/health`, healthRouter);
app.use(`${routePrefix}/admin`, AuthMiddleware.isAdmin ,adminRouter);
app.use(`${routePrefix}/shopify/auth`, shopifyAuthRouter);
app.use(`${routePrefix}/billing`, billingRouter);
app.use(`${routePrefix}/support/shopify`, AuthMiddleware.isShopifyAuthenticated, RequestMiddleware.setEcommerceIdAsShopify, supportRouter);
app.use(`${routePrefix}/tenant`, AuthMiddleware.isShopifyAuthenticated, tenantRouter);
app.use(`${routePrefix}/proxy`, AuthMiddleware.isShopifyAuthenticated, proxyRouter);

app.use('/', ErrorController.notFound);
app.use(ErrorController.errorHandler);

if (!process.env.PORT) process.exit(1);

app.listen(process.env.PORT, '::'); 

logger.info4(`Listening on port ${process.env.PORT} for environment '${process.env.ENV ? process.env.ENV : "PROD"}'. API type: ${process.env.API_TYPE} - Version: ${process.env.VERSION}`);


