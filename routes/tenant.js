import express from "express";
import TenantController from "../controllers/TenantController.js";

const router = express.Router();

router.get("/sync_status", TenantController.getSyncStatus);
router.get("/", TenantController.getTenant);
router.patch("/", TenantController.patchTenant);
router.delete("/", TenantController.deleteTenant);

export default router;