import express, { type ErrorRequestHandler } from "express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Auth } from "./config/better-auth.config.js";
import { providerControllerErrorHandler } from "./controllers/api.controller.js";
import { logger } from "./lib/logger.lib.js";
import { createApiRoutes } from "./routes/api.routes.js";
import { createGatewayRoutes } from "./routes/gateway.routes.js";

export function createApp(auth: Auth) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: "https://lattice.princechaurasiya.in",
      credentials: true,
      exposedHeaders: [
        "x-gateway-provider",
        "anthropic-request-id",
        "request-id",
      ],
    }),
  );
  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.all("/api/auth", toNodeHandler(auth));
  app.all("/api/auth/{*splat}", toNodeHandler(auth));

  app.use(
    express.json({
      limit: "1mb",
      strict: true,
    }),
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: "1mb",
    }),
  );

  app.use("/api", createApiRoutes(auth));
  app.use("/v1", createGatewayRoutes());

  app.get("/", (_req, res) => {
    res.status(200).json({
      name: "LLM Gateway",
      description:
        "Multi-provider OpenAI- and Anthropic-compatible API gateway",
      version: "1.0.0",
      documentation: "/health",
    });
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "llm-gateway",
      timestamp: new Date().toISOString(),
    });
  });

  app.use(providerControllerErrorHandler);

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        message: "Route not found",
        type: "not_found",
        code: "ROUTE_NOT_FOUND",
      },
    });
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    logger.error({ err }, "Unhandled request error");

    if (res.headersSent) {
      return;
    }

    const status =
      err instanceof SyntaxError && "status" in err && err.status === 400
        ? 400
        : 500;

    res.status(status).json({
      error: {
        message:
          status === 400
            ? "Invalid JSON request body"
            : "Internal server error",
        type: status === 400 ? "invalid_request_error" : "server_error",
        code: status === 400 ? "INVALID_JSON" : "INTERNAL_ERROR",
      },
    });
  };

  app.use(errorHandler);

  return app;
}
