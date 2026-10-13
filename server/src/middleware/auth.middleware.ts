import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { Auth } from "../config/better-auth.config.js";

export interface AuthenticatedLocals {
  userId: string;
}

export type AuthenticatedHandler = RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, unknown>,
  AuthenticatedLocals
>;

export function requireAuth(auth: Auth): AuthenticatedHandler {
  return async (req, res, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: {
        disableCookieCache: true,
      },
    });

    if (!session) {
      res.status(401).json({
        error: {
          message: "Authentication required",
          type: "authentication_error",
          code: "UNAUTHENTICATED",
        },
      });
      return;
    }

    res.locals.userId = session.user.id;
    next();
  };
}
