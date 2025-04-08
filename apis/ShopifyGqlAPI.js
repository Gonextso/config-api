import CoreAPI from "../core/CoreAPI.js";

export default class ShopifyGqlAPI extends CoreAPI {
    constructor(config) {
        super();
        this.config = config;
    }

    query = async (query, variables) => {  
        const response = await this.httpRequest.gpost(`https://${this.config.shopify.shopName}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
            query,
            variables
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': this.config.shopify.decyrptedApiKey
            }
        });

        return response.data;
    }

    getShopInfo = async (shop, accessToken) => {
        const shopUrl = `https://${shop}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/shop.json`;
    
        const response = await this.httpRequest.get(shopUrl, {
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            }
        });
    
        return response.data.shop;
    }

    getAccessToken = async (shop, code) => {
        const accessTokenPayload = {
            client_id: process.env.SHOPIFY_CLIENT_ID,
            client_secret: process.env.SHOPIFY_CLIENT_SECRET,
            code,
        };

        const response = await this.httpRequest.post(`https://${shop}/admin/oauth/access_token`, accessTokenPayload);

        return response.data.access_token;
    }
}