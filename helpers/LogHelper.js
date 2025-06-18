import chalk from "chalk";
import CLSHelper from "./CLSHelper.js";
import StringHelper from "./StringHelper.js";

export default class LogHelper {
    constructor(tenant) {
        this.tenant = tenant;
    }

    #addTenantNameToMessage = _ => chalk.cyan(`[${this.tenant ? this.tenant.name.toUpperCase() : "NO_TENANT"}]`)
    #addRequestIdToMessage = _ => `[${CLSHelper.get('traceId') ?? "INTERNAL"}]`

    info = (message) => {
        console.log(chalk.green("[Info]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), StringHelper.truncateString(message));
    }

    info2 = (message) => {
        console.log(chalk.green("[Info]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), chalk.magenta(StringHelper.truncateString(message)));
    }

    info3 = (message) => {
        console.log(chalk.green("[Info]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), chalk.yellowBright(StringHelper.truncateString(message)));
    }

    info4 = (message) => {
        console.log(chalk.green("[Info]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), chalk.blueBright(StringHelper.truncateString(message)));
    }

    warn = (message) => {
        console.log(chalk.yellow("[Warning]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), chalk.yellow(StringHelper.truncateString(message)));
    }

    warn2 = (message) => {
        console.log(chalk.yellow("[Warning]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), chalk.rgb(247, 96, 20)(StringHelper.truncateString(message)));
    }

    error = (error) => {
        const temp = {
            message: error.message,
            stack: error.stack
        }

        console.log(chalk.red("[Error]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), chalk.red(StringHelper.truncateString(JSON.stringify(temp))));
    }

    success = (message) => {
        console.log(chalk.blue("[Success]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), chalk.green(StringHelper.truncateString(message)));
    }

    success2 = (message) => {
        console.log(chalk.blue("[Success]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), chalk.cyan(StringHelper.truncateString(message)));
    }

    request = (message) => {
        console.log(chalk.green("[Info]"), this.#addTenantNameToMessage(), this.#addRequestIdToMessage(), StringHelper.truncateString(message));
    }
}