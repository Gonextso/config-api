import express from "express";
import ShopifyAuthController from "../../controllers/ShopifyAuthController.js";
import AuthMiddleware from "../../middlewares/AuthMiddleware.js";

const router = express.Router();

router.post("/initialize_tenant", ShopifyAuthController.initializeTenant);
router.post("/offline_token", AuthMiddleware.isAppTokenAuthenticated, ShopifyAuthController.storeOfflineToken);

export default router;
