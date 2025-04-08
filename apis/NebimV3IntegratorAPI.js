import CoreAPI from "../core/CoreAPI.js";
import NebimCache from "../cache/NebimCache.js";
import HttpStatusCodes from "../enums/HttpStatusCodes.js";

export default class NebimV3IntegratorAPI extends CoreAPI {
    constructor(config) {
        super(); 
        this.config = config;
        this.cache = new NebimCache(config.name);
    }

    connectionProvider = async exec => {
        let response;
        let tokenData = await this.cache.get("Token");

        if(!tokenData || tokenData.expiryDate < Date.now()) {
            response = await this.webRequest.post(`${this.config.nebim.host}/IntegratorService/Connect`, {
                UserGroupCode: this.config.nebim.userGroup,
                UserName: this.config.nebim.user,
                Password: this.config.nebim.password,
                Validate: true
            });

            if(response.data["Exception"]) this.throws(response.data["Exception"]);

            let accessToken = response.data["Token"];
            const now = new Date();

            if (!accessToken) this.throws("Something went wrong while connecting Nebim V3 Integrator");

            tokenData = { token: accessToken, expiryDate: new Date(now.getTime() + 24 * 60 * 60 * 1000) };

            await this.cache.set("Token", tokenData);
        }

        const data = await exec({
            "Token": tokenData.token,
            "Content-Type": "application/json"
        });

        if (data["StatusCode"] >= HttpStatusCodes.BAD_REQUEST) this.throws(data["ExceptionMessage"]);

        return data;
    }

    runProc = async (procName, parameters) => await this.connectionProvider(async headers => {
        const response = await this.webRequest.post(`${this.config.nebim.host}/IntegratorService/RunProc`, {
            "ProcName": procName,
            ...parameters
        }, {
            headers: headers
        });

        return response.data;
    })

    runProcReturnSingle = async (procName, parameters) => await this.connectionProvider(async headers => {
        const response = await this.webRequest.post(`${this.config.nebim.host}/IntegratorService/RunProcReturnSingle`, {
            "ProcName": procName,
            ...parameters
        }, {
            headers: headers
        });

        return response.data ?? {};
    })

    getModel = async (type, key) => await this.connectionProvider(async headers => {
        let dictionary = { ModelType:0 };

        switch (type) {
            case "customer":
                dictionary = { ModelType: 3, CurrAccCode: key }
            default:
                break;
        }

        const response = await this.webRequest.post(`${this.config.nebim.host}/IntegratorService/GetModel`, dictionary, {
            headers: headers
        });

        return response.data;
    })

    post = async (data, customHeaders = {}) => await this.connectionProvider(async headers => {
        const response = await this.webRequest.post(`${this.config.nebim.host}/IntegratorService/Post`, data, {
            headers: {
                ...customHeaders,
                ...headers
            }
        });

        return response.data;
    })
}