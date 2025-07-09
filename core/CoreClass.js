import chalk from "chalk";
import LogHelper from "../helpers/LogHelper.js";
import CLSHelper from "../helpers/CLSHelper.js";
import ClientError from "../models/error/ClientError.js"

export default class CoreClass {
    constructor(tenant) {
        this.tenant = tenant;
        this.logger = new LogHelper(tenant);
        this.traceId = CLSHelper.get('traceId');
    }
    
    throws = (message, isClientError = false) => {
        if (isClientError) {
            throw new ClientError(message)
        } 
        
        throw new Error(message);
    }

    exit = (reason) => {
        console.log(chalk.white("Error:"), chalk.red(reason));

        process.exit(1);
    }

    logger = null;
}