import RedisAPI from "../apis/RedisAPI.js";
import CacheDatabases from "../enums/CacheDatabases.js";
import CoreClass from "./CoreClass.js";

export default class CoreCache extends CoreClass {
    constructor(tenant) {
        super(tenant);
        if(!tenant) this.throws("tenant must be provided");
        
        this.redis = new RedisAPI(CacheDatabases.DB_NAMES[this.constructor.name])
    }

    set = async (key, value) => {
        if (typeof value === "object") {
            await this.redis.setCache(`${this.tenant.name}:${key}`, JSON.stringify(value));
        } else {
            await this.redis.setCache(`${this.tenant.name}:${key}`, value);
        }
    }

    get = async key => {
        const value = await this.redis.getCache(`${this.tenant.name}:${key}`);

        if(value && value.includes('{')) {
            return JSON.parse(value);
        } 
        
        return value;
    }

    getAll = async key => {
        return this.redis.getAllCache(key ? `${this.tenant.name}:${key}` : this.tenant.name);
    }

    delete = async key => {
        await this.redis.deleteCache(`${this.tenant.name}:${key}`);
    }

    flush = async () => {
        await this.redis.flushCache();
    }

    lock = async (transactionId) => {
        return this.redis.lock(`${this.tenant.name}:${transactionId}`);
    }

    unlock = async (transactionId) => {
        await this.redis.unlock(`${this.tenant.name}:${transactionId}`);
    }
}