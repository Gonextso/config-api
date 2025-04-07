import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import ErrorController from '../controllers/ErrorController.js';
import healthRouter  from '../routes/health.js' ;
import shopifyAuthRouter from '../routes/shopify/auth.js';
import RequestMiddleware from '../middlewares/RequestMiddleware.js';
import LogHelper from '../helpers/LogHelper.js';

LogHelper.info2('Building Express API started');

const app = express();
const routePrefix = `/rest/${process.env.API_TYPE}/${process.env.VERSION}`;

app.use(helmet());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(morgan(function (tokens, req, res) {
    return LogHelper.request([
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
app.use(`${routePrefix}/shopify/auth`, shopifyAuthRouter);

app.use('/', ErrorController.notFound);
app.use(ErrorController.internalServerError);

if (!process.env.PORT) process.exit(1); //TODO: add log

app.listen(process.env.PORT); 

LogHelper.info4(`Listening on port ${process.env.PORT} for environment '${process.env.ENV ? process.env.ENV : "PROD"}'. API type: ${process.env.API_TYPE} - Version: ${process.env.VERSION}`);


