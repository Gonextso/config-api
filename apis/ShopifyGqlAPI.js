import CoreAPI from "../core/CoreAPI.js";
import storeQueries from "../models/shopify/queries/store.js";
import ShopifyTokenService from "../helpers/ShopifyTokenService.js";

export default class ShopifyGqlAPI extends CoreAPI {
    constructor(tenant) {
        super(tenant);
        this.config = tenant?.shopify;
    }

    // Resolved per call (not once per request) so long-running work survives token rotation.
    // Tenants loaded from the database go through ShopifyTokenService; ad-hoc configs used
    // during install (no tenant id yet) keep using the token they were given.
    accessToken = async (rejectedToken) => {
        const tenantId = this.tenant?.id ?? this.tenant?._id;
        if (tenantId && this.config?.name) {
            const token = await ShopifyTokenService.getAccessToken(String(tenantId), `${this.config.name}.myshopify.com`, { rejectedToken });
            if (token) return token;
        }

        return this.config.decryptedApiKey;
    }

    query = async (query, variables) => {
        const url = `https://${this.config.name}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`;
        const send = token => this.httpRequest.gpost(url, { query, variables }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': token
            }
        });

        const token = await this.accessToken();
        let response;
        try {
            response = await send(token);
        } catch (error) {
            if (error?.response?.status !== 401) throw error;

            // The token may have been rotated or retired elsewhere; retry once with a fresh one.
            const retryToken = await this.accessToken(token);
            if (!retryToken || retryToken === token) throw error;
            response = await send(retryToken);
        }

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