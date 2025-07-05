import CoreController from "../core/CoreControler.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import ClientError from "../models/error/ClientError.js";

export default new class ErrorController extends CoreController {
    constructor() {
        super();
    }

    notFound = async (req, res) => {
        return this.response(res, { status: HttpStatusCodes.NOT_FOUND, info: `Requested url: ${req.url} not found` });
    }
    errorHandler = async (error, req, res, next) => {
        if (error instanceof ClientError) return this.response(res, { status: HttpStatusCodes.BAD_REQUEST, info: error.message });
        else return this.response(res, { status: HttpStatusCodes.SERVER_ERROR, error });
    }
}