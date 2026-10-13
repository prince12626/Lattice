import { createApp } from "./app.js";
import { createAuth } from "./config/better-auth.config.js";
import { env } from "./config/env.config.js";
import {
  connectDatabase,
  disconnectDatabase,
  getDatabase,
} from "./lib/database.lib.js";
import { logger } from "./lib/logger.lib.js";

async function startServer(): Promise<void> {
  await connectDatabase();

  const auth = createAuth(getDatabase());
  const app = createApp(auth);

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(
      {
        host: env.HOST,
        port: env.PORT,
        environment: env.NODE_ENV,
      },
      "LLM Gateway server started",
    );
  });

  let shuttingDown = false;

  function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "Graceful shutdown started");

    const forceExit = setTimeout(() => {
      logger.error("Graceful shutdown timed out");
      process.exit(1);
    }, 10_000);

    forceExit.unref();

    server.close((error) => {
      if (error) {
        logger.error({ err: error }, "HTTP server shutdown failed");
        process.exitCode = 1;
      } else {
        logger.info("HTTP server closed");
      }

      void disconnectDatabase().catch((disconnectError: unknown) => {
        logger.error({ err: disconnectError }, "MongoDB shutdown failed");
        process.exitCode = 1;
      });
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection");
    shutdown("unhandledRejection");
  });
}

void startServer().catch((error: unknown) => {
  logger.fatal({ err: error }, "Server startup failed");
  process.exitCode = 1;
});
