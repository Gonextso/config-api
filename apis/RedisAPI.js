import CoreAPI from "../core/CoreAPI.js";
import ClientProvider from "../cache/ClientProvider.js";

export default class RedisAPI extends CoreAPI {
    constructor(dbIndex) {
        super();
        this.client = new ClientProvider(dbIndex).client;
    }

    setCache = async (key, value) => {
        await this.client.set(key, value);
    };

    getCache = async key => {
        const data = await this.client.get(key);
        return data || null;
    };

    getAllCache = async key => {
        const keys = await this.client.keys(`${key}:*`);
        const values = await Promise.all(keys.map(async key => {
            const value = await this.client.get(key);
            return { key, value: JSON.parse(value) };
        }));
        return values;
    };

    deleteCache = async key => {
        await this.client.del(key);
    };

    flushCache = async _ => {
        await this.client.flushDb();
    };

    lock = async key => {
        const isLocked = await this.client.set(key, '1', { NX: true, EX: 1000 });
        
        return isLocked === 'OK';
    }

    unlock = async key => {
        await this.client.del(key);
    }
}