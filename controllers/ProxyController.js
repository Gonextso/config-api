import CoreController from "../core/CoreControler.js";
import axios from "axios";
import http from 'http';
import HttpStatusCodes from "../enums/HttpStatusCodes.js";

const agent = new http.Agent({ keepAlive: false });

export default new class ProxyController extends CoreController {
    constructor() {
        super();
    }

    proxyToIntegration = async (req, res) => {
        try {
            const path = Array.isArray(req.params.splat) ? req.params.splat.join('/') : (req.params.splat || '');
            const url = `${process.env.INTEGRATION_API_HOST}/${path}`;
            const ALLOWED_PATHS = [
                'shopify/nebim/order/sync_failed',
                'shopify/nebim/customer/consent/gsm',
                'shopify/nebim/customer/consent/email',
                'cache/get',
                'cache/delete'
            ];

            if (typeof path === 'string' && !ALLOWED_PATHS.some(allowedPath => path.toLocaleLowerCase() === allowedPath)) {
                return this.response(res, { status: HttpStatusCodes.UNAUTHORIZED, info: 'Forbidden path' });
            }

            const method = req.method.toLowerCase();

            const { host, connection, 'content-length': contentLength, 'transfer-encoding': transferEncoding, ...inboundHeaders } = req.headers;

            const axiosConfig = {
                method,
                url,
                headers: {
                    ...inboundHeaders,
                    'Content-Type': 'application/json',
                    'X-Proxied-By': 'config-api',
                    'X-Forwarded-For': req.ip,
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Original-Path': req.originalUrl,
                    'x-tenant-id': req.tenant.id
                },
                httpAgent: agent,
                data: req.body,
                params: req.query,
            };

            const response = await axios(axiosConfig);
            return res.status(response.status).json(response.data);
        } catch (error) {
            const status = error.response?.status || 500;
            const message = error.response?.data || error.message;
            return res.status(status).json(message);
        }
    };
}