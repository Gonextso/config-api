import express from "express";
import AdminController from "../controllers/AdminController.js";

const router = express.Router();

router.get("/check", AdminController.health);
router.get("/tenants", AdminController.getTenants);
router.get("/tenant/:tenant_id", AdminController.getTenantById);
router.get("/overview/:tenant_id", AdminController.getTenantOverview);
router.get("/logs/:tenant_id", AdminController.getTenantLogs);
router.get("/log/:tenant_id/:log_id", AdminController.getTenantLogById);
router.get("/jobs/:tenant_id", AdminController.getTenantJobs);
router.get("/recent-jobs", AdminController.getRecentJobs);
router.get("/job/:tenant_id/:job_id", AdminController.getTenantJobById);
router.patch("/tenant/:tenant_id/billing", AdminController.patchTenantBilling);
router.patch("/tenant/:tenant_id/settings", AdminController.patchTenantSettings);
router.get("/notifications", AdminController.getNotifications);
router.post("/notifications", AdminController.createNotification);
router.patch("/notification/:notification_id", AdminController.updateNotification);
router.delete("/notification/:notification_id", AdminController.deleteNotification);

export default router;