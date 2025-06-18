import express from "express";
import AdminController from "../controllers/AdminController.js";

const router = express.Router();

router.get("/check", AdminController.health);
router.post("/create_test_tenant", AdminController.createTestTenant);
router.post("/delete_all_tenants", AdminController.deleteAllTenants);

export default router;