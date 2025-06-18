import CacheDatabases from '../enums/CacheDatabases.js';

export default class ClientProvider {
    constructor(dbIndex) {
        switch (dbIndex) {
            case CacheDatabases.DB_NAMES.SystemCache:
                this.client = ClientProvider.systemClient;
                break
            case CacheDatabases.DB_NAMES.NebimCache:
                this.client = ClientProvider.nebimClient;
                break
            case CacheDatabases.DB_NAMES.ShopifyCache:
                this.client = ClientProvider.shopifyClient;
                break
        }
    }

    static systemClient = null;

    static nebimClient = null;

    static shopifyClient = null;
}