import chalk from "chalk";
import LogHelper from "../helpers/LogHelper.js";
import CLSHelper from "../helpers/CLSHelper.js";

export default class CoreClass {
    constructor(tenant) {
        this.tenant = tenant;
        this.logger = new LogHelper(tenant);
        this.traceId = CLSHelper.get('traceId');
    }
    
    throws = (message) => {
        throw new Error(message);
    }

    exit = (reason) => {
        console.log(chalk.white("Error:"), chalk.red(reason));

        process.exit(1);
    }

    logger = null;
}