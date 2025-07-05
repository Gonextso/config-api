import namespace from "../helpers/CLSHelper.js";
import StringHelper from "../helpers/StringHelper.js";


export default new class LogMiddleware {
    setTraceId = async (req, res, next) => {
        namespace.run(_ => {
            const traceId = StringHelper.generateUUID();

            namespace.set('traceId', traceId);
            req.traceId = traceId;
            res.setHeader('X-Trace-Id', traceId);

            next();
        })
    }

    setEcommerceIdAsShopify = async (req, _, next) => {
        req.ecommerceId = "shopify";
        next();
    }
}