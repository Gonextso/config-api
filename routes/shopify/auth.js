import express from "express";
import ShopifyAuthController from "../../controllers/ShopifyAuthController.js";

const router = express.Router();

router.get("/callback", ShopifyAuthController.callback);
router.post("/initialize_tenant", ShopifyAuthController.initializeTenant);

export default router;