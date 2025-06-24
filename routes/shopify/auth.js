import express from "express";
import ShopifyAuthController from "../../controllers/ShopifyAuthController.js";

const router = express.Router();

router.post("/initialize_tenant", ShopifyAuthController.initializeTenant);
router.delete("/delete_tenant", ShopifyAuthController.deleteTenant);

export default router;