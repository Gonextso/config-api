import CoreController from "../core/CoreControler.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";

export default new class ErrorController extends CoreController {
    constructor() {
        super();
    }

    notFound = async (req, res) => {
        return this.response(res, { status: HttpStatusCodes.NOT_FOUND, info: `Requested url: ${req.url} not found` });
    }
    internalServerError = async (error, req, res, next) => {
        return this.response(res, { status: HttpStatusCodes.SERVER_ERROR, error });
    }
}