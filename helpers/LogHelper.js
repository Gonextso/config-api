import chalk from "chalk";
import CLSHelper from "./CLSHelper.js";
import StringHelper from "./StringHelper.js";

export default class LogHelper {
    static #addRequestIdToMessage = _ => `[ ${CLSHelper.get('traceId') ?? "INTERNAL"} ]`

    static info = (message) => {
        console.log(chalk.green("[ Info ]"), this.#addRequestIdToMessage(), StringHelper.truncateString(message));
    }

    static info2 = (message) => {
        console.log(chalk.green("[ Info ]"), this.#addRequestIdToMessage(), chalk.magenta(StringHelper.truncateString(message)));
    }

    static info3 = (message) => {
        console.log(chalk.green("[ Info ]"), this.#addRequestIdToMessage(), chalk.yellowBright(StringHelper.truncateString(message)));
    }

    static info4 = (message) => {
        console.log(chalk.green("[ Info ]"), this.#addRequestIdToMessage(), chalk.blueBright(StringHelper.truncateString(message)));
    }

    static warn = (message) => {
        console.log(chalk.yellow("[ Warning ]"), this.#addRequestIdToMessage(), chalk.yellow(StringHelper.truncateString(message)));
    }

    static warn2 = (message) => {
        console.log(chalk.yellow("[ Warning ]"), this.#addRequestIdToMessage(), chalk.rgb(247, 96, 20)(StringHelper.truncateString(message)));
    }

    static error = (error) => {
        const temp = {
            message: error.message,
            stack: error.stack
        }

        console.log(chalk.red("[ Error ]"), this.#addRequestIdToMessage(), chalk.red(StringHelper.truncateString(JSON.stringify(temp))));
    }

    static success = (message) => {
        console.log(chalk.blue("[ Success ]"), this.#addRequestIdToMessage(), chalk.green(StringHelper.truncateString(message)));
    }

    static success2 = (message) => {
        console.log(chalk.blue("[ Success ]"), this.#addRequestIdToMessage(), chalk.cyan(StringHelper.truncateString(message)));
    }

    static request = (message) => {
        console.log(chalk.green("[ Info ]"), this.#addRequestIdToMessage(), StringHelper.truncateString(message));
    }
}