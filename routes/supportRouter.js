import express from "express";
import SupportController from "../controllers/SupportController.js";

const router = express.Router();

router.get("/tickets", SupportController.getTickets);
router.post("/ticket/create/:type", SupportController.createTicket);
router.post("/ticket/comment/:ticketId", SupportController.addCommentToTicket);
router.put("/ticket/close/:ticketId", SupportController.closeTicket);

export default router;