import { Router } from "express";
import {
  createChatCompletion,
  listModels,
} from "../controllers/chat-completions.controller.js";
import { createAnthropicMessage } from "../controllers/anthropic-messages.controller.js";
import { requireGatewayToken } from "../middleware/gateway-token.middleware.js";

export function createGatewayRoutes() {
  const router = Router();

  router.use(requireGatewayToken);
  router.post("/chat/completions", createChatCompletion);
  router.post("/messages", createAnthropicMessage);
  router.get("/models", listModels);

  return router;
}
