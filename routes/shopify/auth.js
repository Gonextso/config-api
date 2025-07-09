import express from "express";
import ShopifyAuthController from "../../controllers/ShopifyAuthController.js";

const router = express.Router();

router.post("/initialize_tenant", ShopifyAuthController.initializeTenant);

export default router;