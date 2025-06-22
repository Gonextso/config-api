import express from "express";
import ProxyController from "../controllers/ProxyController.js";

const router = express.Router();

router.use("/integration/{*splat}", ProxyController.proxyToIntegration);

export default router;