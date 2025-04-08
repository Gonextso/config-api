import express from "express";
import AdminController from "../controllers/AdminController.js";

const router = express.Router();

router.get("/check", AdminController.health);

export default router;