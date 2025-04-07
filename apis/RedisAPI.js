import BaseAPI from "../base/BaseAPI.js";
import CacheManager from "../managers/CacheManager.js";

export default class RedisAPI extends BaseAPI {
    constructor(dbIndex) {
        super();
        this.client = CacheManager.client;
        this.dbIndex = dbIndex ?? 0;
    }

    setCache = async (key, value) => {
        await this.client.select(this.dbIndex);
        await this.client.set(key, value);
    };

    getCache = async key => {
        await this.client.select(this.dbIndex);
        const data = await this.client.get(key);
        return data || null;
    };

    getAllCache = async key => {
        await this.client.select(this.dbIndex);
        const keys = await this.client.keys(`${key}:*`);
        const values = await Promise.all(keys.map(async key => {
            const value = await this.client.get(key);
            return { key, value: JSON.parse(value) };
        }));
        return values;
    };

    deleteCache = async key => {
        await this.client.select(this.dbIndex);
        await this.client.del(key);
    };

    flushCache = async _ => {
        await this.client.select(this.dbIndex);
        await this.client.flushDb();
    };
}