import type { RequestHandler } from "express";
import {
  GatewayToken,
  hashGatewayToken,
} from "../models/gateway-token.model.js";
import type { AuthenticatedLocals } from "./auth.middleware.js";

export const requireGatewayToken: RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, unknown>,
  AuthenticatedLocals
> = async (req, res, next) => {
  const authorization = req.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const apiKeyToken = req.get("x-api-key");
  const token = bearerToken ?? apiKeyToken;

  if (!token) {
    if (req.path === "/messages") {
      res.status(401).json({
        type: "error",
        error: {
          type: "authentication_error",
          message: "A valid gateway API key is required",
        },
      });
      return;
    }

    res.status(401).json({
      error: {
        message: "A valid gateway API key is required",
        type: "authentication_error",
        code: "INVALID_API_KEY",
      },
    });
    return;
  }

  const gatewayToken = await GatewayToken.findOne({
    tokenHash: hashGatewayToken(token),
  }).exec();

  if (!gatewayToken) {
    if (req.path === "/messages") {
      res.status(401).json({
        type: "error",
        error: {
          type: "authentication_error",
          message: "A valid gateway API key is required",
        },
      });
      return;
    }

    res.status(401).json({
      error: {
        message: "A valid gateway API key is required",
        type: "authentication_error",
        code: "INVALID_API_KEY",
      },
    });
    return;
  }

  await GatewayToken.updateOne(
    { _id: gatewayToken._id },
    { $set: { lastUsedAt: new Date() } },
  ).exec();

  res.locals.userId = gatewayToken.userId;
  next();
};
