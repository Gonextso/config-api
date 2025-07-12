import express from "express";
import ShopifyAuthController from "../../controllers/ShopifyAuthController.js";
import AuthMiddleware from "../../middlewares/AuthMiddleware.js";

const router = express.Router();

router.post("app/uninstalled", AuthMiddleware.isShopifyHmacValid, ShopifyAuthController.handleUninstalled);

export default router;