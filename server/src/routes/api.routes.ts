import { Router } from "express";
import type { Auth } from "../config/better-auth.config.js";
import {
  createApiProviderController,
  deleteApiProvider,
  getApiProvider,
  listApiProviders,
  updateApiProvider,
} from "../controllers/api.controller.js";
import {
  createGatewayTokenController,
  deleteGatewayToken,
  listGatewayTokens,
} from "../controllers/gateway-token.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export function createApiRoutes(auth: Auth) {
  const router = Router();

  router.use(requireAuth(auth));
  router
    .route("/tokens")
    .get(listGatewayTokens)
    .post(createGatewayTokenController);
  router.delete("/tokens/:id", deleteGatewayToken);
  router
    .route("/providers")
    .get(listApiProviders)
    .post(createApiProviderController);
  router
    .route("/providers/:id")
    .get(getApiProvider)
    .patch(updateApiProvider)
    .delete(deleteApiProvider);

  return router;
}
