import { Router } from "express";
import { chat } from "../services/chatService.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const chatRouter = Router();

chatRouter.post("/", rateLimit({ max: 40, windowMs: 15 * 60 * 1000 }), async (req, res, next) => {
  try {
    const result = await chat({ messages: req.body?.messages || [] });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
