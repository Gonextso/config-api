import express from "express";
import ShopifyAuthController from "../../controllers/ShopifyAuthController.js";
import AuthMiddleware from "../../middlewares/AuthMiddleware.js";

const router = express.Router();

router.post("/initialize_tenant", ShopifyAuthController.initializeTenant);

router.post("/gdpr/customers/data_request", AuthMiddleware.isShopifyHmacValid, ShopifyAuthController.handleGdprDataRequest);
router.post("/gdpr/customers/redact", AuthMiddleware.isShopifyHmacValid, ShopifyAuthController.handleGdprCustomersRedact);
router.post("/gdpr/shop/redact", AuthMiddleware.isShopifyHmacValid, ShopifyAuthController.handleGdprShopRedact);

export default router;