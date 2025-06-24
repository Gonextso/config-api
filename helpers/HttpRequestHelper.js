import axios from "axios";
import StringHelper from "./StringHelper.js";
import CoreHelper from "../core/CoreHelper.js";

export default class HttpRequestHelper extends CoreHelper {
    constructor() {
        super();
    }

    get = async (...args) => {
        const id = StringHelper.generateUUID();

        this.logger.info4(`request_id:${id} - Request send to external system; HTTP/GET; ${args.map(x => typeof x === 'object' ? JSON.stringify(x.headers ? this.#removeSecrets(x.headers) : x) : x.toString()).join('; ')}`);

        return this.#trackRequest(() => axios.get(...args).then(response => {
            this.logger.info3(`request_id:${id} - Response from external system; status ${response.status}; ${JSON.stringify(response.data)}`);

            return response;
        }), id);
    }

    post = async (...args) => {
        const id = StringHelper.generateUUID();

        this.logger.info4(`request_id:${id} - Request send to external system; HTTP/POST; ${args.map(x => typeof x === 'object' ? JSON.stringify(x.headers ? this.#removeSecrets(x.headers) : x) : x.toString()).join('; ')}`);

        return this.#trackRequest(() => axios.post(...args).then(response => {
            this.logger.info3(`request_id:${id} - Response from external system; status ${response.status}; ${JSON.stringify(response.data)}`);

            return response;
        }), id);
    }

    gpost = async (...args) => {
        const id = StringHelper.generateUUID();

        this.logger.info4(`request_id:${id} - Request send to external system; HTTP/POST; ${args.map(x => typeof x === 'object' ? JSON.stringify(x.headers ? this.#removeSecrets(x.headers) : x).replace(/\\n/g, '').replace(/ /g, '') : x.toString()).join(' ; ')}`);

        return this.#trackRequest(() => axios.post(...args).then(response => {
            this.logger.info3(`request_id:${id} - Response recieved from external system; status ${response.status}; ${JSON.stringify(response.data)}`);

            return response;
        }), id);
    }

    #removeSecrets = (object) => {
        const headers = JSON.parse(JSON.stringify(object));
        Object.keys(headers).map(x => x.toLowerCase().includes('token') ? headers[x] = "masked_by_gonextso" : headers[x])

        return headers;
    }

    #getEndTime = (start) => {
        const [seconds, nanoseconds] = process.hrtime(start);
        return seconds * 1e3 + nanoseconds / 1e6;; 
    }

    #trackRequest = (method, id) => {
        const start = process.hrtime();

        return method().then(result => {
            this.logger.info3(`request_id:${id} - Processed in ${this.#getEndTime(start).toFixed(2)} ms`);

            return result;
        })
    }
}
