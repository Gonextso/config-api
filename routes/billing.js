import express from "express";
import BillingController from "../controllers/BillingController.js";

const router = express.Router();

router.get("/plans", BillingController.getPlans);
router.get("/subscribe", BillingController.subscribeToPlan);
router.get("/confirm", BillingController.confirmCallback);

export default router;