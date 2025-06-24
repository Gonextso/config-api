import express from "express";
import TenantController from "../controllers/TenantController.js";

const router = express.Router();

router.get("/", TenantController.getTenant);
router.patch("/", TenantController.patchTenant);

export default router;