import CoreController from "../core/CoreControler.js";
import Company from "../models/db/Company.js";
import ShopifyGqlAPI from "../apis/ShopifyGqlAPI.js";
import CyrptoHelper from "../helpers/CyrptoHelper.js"
import HttpStatusCodes from "../enums/HttpStatusCodes.js";

export default new class ShopifyAuthController extends CoreController {
    constructor() {
        super();
        this.api = new ShopifyGqlAPI();
    }

    callback = async (req, res) => {
        const { code, shop } = req.query;

        if (!code || !shop) return this.response(res, 
            { 
                info: "Missing parameters on callback request", 
                status: HttpStatusCodes.BAD_REQUEST 
            });

        const shopifyAccessToken = await this.api.getAccessToken(shop, code);
        const shopifyShopInfo = await this.api.getShopInfo(shop, shopifyAccessToken);

        let company = Company.findOne({ 'shopify.domain': shopifyShopInfo.domain });

        if (company) {
            this.logger.info2(`${company.name} will be updated`);
            //TODO: implement update logic
        } else {
            this.logger.info2(`${shopifyShopInfo.name} will be created`);

            company = new Company({
                name: shopifyShopInfo.name,
                salesUrl: shopifyShopInfo.myshopifyDomain,
                shopify: {
                    name: shopifyShopInfo.name,
                    domain: shopifyShopInfo.domain,
                    shopifyShopId: shopifyShopInfo.id,
                    shopOwnerEmail: shopifyShopInfo.owner.email,
                    plan: shopifyShopInfo.plan.name,
                    apiKey: CyrptoHelper.encrypt(shopifyAccessToken)
                }
            });

            const { hash, key } = CyrptoHelper.generateHashedKey();

            company.apiKey = hash;

            await company.save();

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