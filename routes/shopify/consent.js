import express from "express";
import ShopifyAuthController from "../../controllers/ShopifyAuthController.js";
import AuthMiddleware from "../../middlewares/AuthMiddleware.js";

const router = express.Router();

router.post("/email", AuthMiddleware.isShopifyHmacValid, ShopifyAuthController.handleEmailConsent);
router.post("/gsm", AuthMiddleware.isShopifyHmacValid, ShopifyAuthController.handleGsmConsent);

export default router;
