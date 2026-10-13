import { Router } from "express";
import {
  createChatCompletion,
  listModels,
} from "../controllers/chat-completions.controller.js";
import { requireGatewayToken } from "../middleware/gateway-token.middleware.js";

export function createGatewayRoutes() {
  const router = Router();

  router.use(requireGatewayToken);
  router.post("/chat/completions", createChatCompletion);
  router.get("/models", listModels);

  return router;
}
