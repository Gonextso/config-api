import express from "express";
import BillingController from "../../controllers/BillingController.js";
import AuthMiddleware from "../../middlewares/AuthMiddleware.js";

const router = express.Router();

router.post("/update", AuthMiddleware.isShopifyHmacValid, BillingController.handleSubscriptionUpdate);

export default router;