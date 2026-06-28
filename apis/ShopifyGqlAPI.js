import CoreAPI from "../core/CoreAPI.js";
import storeQueries from "../models/shopify/queries/store.js";

export default class ShopifyGqlAPI extends CoreAPI {
    constructor(tenant) {
        super(tenant);
        this.config = tenant?.shopify;
    }

    query = async (query, variables) => {
        const response = await this.httpRequest.gpost(`https://${this.config.name}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
            query,
            variables
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': this.config.decryptedApiKey
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

    // Fetches the Shopify plan info (incl. shopifyPlus flag) via Admin GraphQL.
    // Accepts shop + accessToken explicitly so it can be used during install (no tenant config yet).
    getShopPlan = async (shop, accessToken) => {
        const url = `https://${shop}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`;

        const response = await this.httpRequest.gpost(url, {
            query: storeQueries.shopPlan
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            }
        });

        return response.data?.data?.shop?.plan ?? null;
    }

    getAccessToken = async (shop, idToken) => {
        const accessTokenPayload = {
            client_id: process.env.SHOPIFY_CLIENT_ID,
            client_secret: process.env.SHOPIFY_CLIENT_SECRET,
            grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
            subject_token: idToken,
            subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
            requested_token_type: "urn:shopify:params:oauth:token-type:online-access-token"
        };

        const response = await this.httpRequest.post(`https://${shop}.myshopify.com/admin/oauth/access_token`, accessTokenPayload, {
            headers: {
                'Content-Type': "application/json"
            }
        });

        return response.data.access_token;
    }
}