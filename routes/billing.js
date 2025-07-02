import express from "express";
import BillingController from "../controllers/BillingController.js";

const router = express.Router();

router.get("/plans", BillingController.getPlans);

export default router;