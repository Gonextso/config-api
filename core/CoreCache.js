import RedisAPI from "../apis/RedisAPI.js";
import CacheDatabases from "../enums/CacheDatabases.js";
import CoreClass from "./CoreClass.js";

export default class CoreCache extends CoreClass {
    constructor(prefix) {
        super();
        if(!prefix) this.throws("Db index and prefix must be provided");

        this.redis = new RedisAPI(CacheDatabases.DB_NAMES[this.constructor.name])
        this.prefix = prefix;
    }

    set = async (key, value) => {
        if (typeof value === "object") {
            await this.redis.setCache(`${this.prefix}:${key}`, JSON.stringify(value));
        } else {
            await this.redis.setCache(`${this.prefix}:${key}`, value);
        }
    }

    get = async key => {
        const value = await this.redis.getCache(`${this.prefix}:${key}`);

        if(value && value.includes('{')) {
            return JSON.parse(value);
        } 
        
        return value;
    }

    getAll = async _ => {
        return this.redis.getAllCache(this.prefix);
    }

    delete = async key => {
        await this.redis.deleteCache(`${this.prefix}:${key}`);
    }

    flush = async () => {
        await this.redis.flushCache();
    }
}