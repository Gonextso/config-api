import HttpStatusCodes from "../enums/HttpStatusCodes.js";
import CoreClass from "./CoreClass.js";

export default class CoreController extends CoreClass {
    constructor() {
        super();
    }

    response = async (res, { content, headers, info, status, error } = { status: HttpStatusCodes.SUCCESS, content: {} }) => {
        if (!res || !status) throw new Error(`Check required parameters: res:${res}, status${status}`);

        const baseResponse = {
            statusCode: status.code,
            headers,
            info: info || status.message,
            isSuccess: status.code < HttpStatusCodes.BAD_REQUEST.code
        }

        if (error) this.logger.error(error);
            
        return res.status(status.code).type('json').send(
            JSON.stringify(!error ?
                {
                    ...baseResponse,
                    content: content && typeof content === 'object' ? content : (content ?? {})
                } :
                {
                    ...baseResponse,
                    error: {
                        message: error.message,
                        stack: ['dev', 'local'].some(x => process.env.ENV?.toLowerCase() === x) ? error.stack : undefined
                    },
                    content: (content ?? {})
                }
                , null, 4) + '\n');
    }
}