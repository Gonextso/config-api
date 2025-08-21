import storeQueries from "../../models/shopify/queries/store.js";
import ShopifyGqlAPI from "../../apis/ShopifyGqlAPI.js";
import CoreClass from "../../core/CoreClass.js";

export default class ShopifyStoreBusiness extends CoreClass {
    constructor(tenant) {
        super(tenant);
        this.api = new ShopifyGqlAPI(tenant);
    }

    //TODO: Depreciated not used
    checkStore = async _ => {
        return (await this.api.query(storeQueries.dummy)).data.publications.nodes.length > 0;
    }

    getShop = async (shop, accessToken) => await this.api.getShopInfo(shop, accessToken);
}