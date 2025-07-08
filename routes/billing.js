import express from "express";
import BillingController from "../controllers/BillingController.js";
import AuthMiddleware from "../middlewares/AuthMiddleware.js";

const router = express.Router();

router.get("/plans", BillingController.getPlans);
router.post("/subscribe", AuthMiddleware.isShopifyAuthenticated, BillingController.subscribeToPlan);
router.get("/confirm", BillingController.confirmCallback);

export default router;