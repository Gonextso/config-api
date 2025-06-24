import SystemCache from "../cache/SystemCache.js"
import CoreClass from "../core/CoreClass.js";

export default new class SystemHelper extends CoreClass {
    constructor() {
        super();
    }

    createTransaction = async (tenant, id, work) => {
        const systemCache = new SystemCache(tenant);
        let result = undefined;

        const lockAcquired = await systemCache.lock(id);

        if (!lockAcquired) {
            this.logger.warn(`Transaction id "${id}" is already locked for tenant "${tenant.name}"`);

            return result;
        }

        try {
            result = await work();
        } finally {
            await systemCache.unlock(id);
        }

        return result;
    }

    wait = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}