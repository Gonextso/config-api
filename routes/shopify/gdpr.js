import express from "express";
import ShopifyAuthController from "../../controllers/ShopifyAuthController.js";
import AuthMiddleware from "../../middlewares/AuthMiddleware.js";

const router = express.Router();

router.post("/customers/data_request", AuthMiddleware.isShopifyHmacValid, ShopifyAuthController.handleGdprDataRequest);
router.post("/customers/redact", AuthMiddleware.isShopifyHmacValid, ShopifyAuthController.handleGdprCustomersRedact);
router.post("/shop/redact", AuthMiddleware.isShopifyHmacValid, ShopifyAuthController.handleGdprShopRedact);

export default router;