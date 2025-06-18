import CoreController from "../core/CoreControler.js";
import Tenant from "../models/db/Tenant.js";
import ShopifyGqlAPI from "../apis/ShopifyGqlAPI.js";
import CryptoHelper from "../helpers/CryptoHelper.js"
import HttpStatusCodes from "../enums/HttpStatusCodes.js";

export default new class ShopifyAuthController extends CoreController {
    constructor() {
        super();
    }

    callback = async (req, res) => {
        const { code, shop } = req.query;
        const api = new ShopifyGqlAPI(req.tenant);

        if (!code || !shop) return this.response(res, 
            { 
                info: "Missing parameters on callback request", 
                status: HttpStatusCodes.BAD_REQUEST 
            });

        const shopifyAccessToken = await api.getAccessToken(shop, code);
        const shopifyShopInfo = await api.getShopInfo(shop, shopifyAccessToken);

        let tenant = await Tenant.findOne({ 'shopify.domain': shopifyShopInfo.domain });

        if (tenant) {
            this.logger.info2(`${tenant.name} will be updated`);
            //TODO: implement update logic
        } else {
            this.logger.info2(`${shopifyShopInfo.name} will be created`);

            tenant = new Tenant({
                name: shopifyShopInfo.name,
                salesUrl: shopifyShopInfo.myshopifyDomain,
                shopify: {
                    name: shopifyShopInfo.name,
                    domain: shopifyShopInfo.domain,
                    shopifyShopId: shopifyShopInfo.id,
                    shopOwnerEmail: shopifyShopInfo.owner.email,
                    plan: shopifyShopInfo.plan.name,
                    apiKey: CryptoHelper.encrypt(shopifyAccessToken)
                }
            });

            const { hash, key } = CryptoHelper.generateHashedKey();

            tenant.apiKey = hash;

            await tenant.save();

            res.cookie("api_key", key, {
                httpOnly: true,
                secure: true,
                sameSite: "Lax",
                maxAge: 1000 * 60 * 60 * 24 * 365 * 10 //! 10 year
            }); //TODO: make rotation
        }

        return res.redirect(`https://@appurl_placeholder/dashboard?shop=${shop}`);  //TODO: make redirect proper
    }
}