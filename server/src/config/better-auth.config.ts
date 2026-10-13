import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { env } from "./env.config.js";

type AuthDatabase = Parameters<typeof mongodbAdapter>[0];

const trustedFrontendOrigins = new Set([new URL(env.FRONTEND_ORIGIN).origin]);
if (env.NODE_ENV !== "production") {
  const localFrontend = new URL(env.FRONTEND_ORIGIN);
  localFrontend.hostname =
    localFrontend.hostname === "localhost" ? "127.0.0.1" : "localhost";
  trustedFrontendOrigins.add(localFrontend.origin);
}

export function createAuth(database: AuthDatabase) {
  return betterAuth({
    database: mongodbAdapter(database),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [
      new URL(env.BETTER_AUTH_URL).origin,
      ...trustedFrontendOrigins,
    ],
    emailAndPassword: {
      enabled: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
