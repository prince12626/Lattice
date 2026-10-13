import pino from "pino";
import { env } from "../config/env.config.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "apiKey",
      "api_key",
      "providerKey",
      "encryptionKey",
      "ENCRYPTION_KEY",
      "GATEWAY_API_KEY",
    ],
    censor: "[REDACTED]",
  },
  ...(env.NODE_ENV === "development"
    ? {}
    : {
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});
