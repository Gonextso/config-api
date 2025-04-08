import CoreController from "../core/CoreControler.js";
import CryptoHelper from "../helpers/CryptoHelper.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";

export default new class AuthMiddleware extends CoreController {
    constructor() {
        super();
    }

    isAdmin = async (req, res, next) => {
        const apiKey = CryptoHelper.hashKey(req.headers['x-api-key'] ?? "");

        if(apiKey !== process.env.ADMIN_API_KEY) return this.response(res, { status: HttpStatusCodes.UNAUTHORIZED });

        return next();
    }
}