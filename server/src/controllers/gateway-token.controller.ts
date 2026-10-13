import type { AuthenticatedHandler } from "../middleware/auth.middleware.js";
import {
  createGatewayToken,
  GatewayToken,
} from "../models/gateway-token.model.js";
import { z } from "zod";

const createTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
  })
  .strict();

export const listGatewayTokens: AuthenticatedHandler = async (_req, res) => {
  const tokens = await GatewayToken.find({ userId: res.locals.userId })
    .sort({ createdAt: -1 })
    .exec();

  res.status(200).json({ data: tokens });
};

export const createGatewayTokenController: AuthenticatedHandler = async (
  req,
  res,
) => {
  const parsed = createTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        message: "Send a JSON object with a name between 1 and 80 characters",
        type: "invalid_request_error",
        code: "INVALID_TOKEN",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  const created = await createGatewayToken(res.locals.userId, parsed.data.name);

  res.status(201).json({
    data: {
      id: created.document.id,
      name: created.document.name,
      token: created.token,
      tokenPrefix: created.document.tokenPrefix,
      createdAt: created.document.createdAt,
    },
  });
};

export const deleteGatewayToken: AuthenticatedHandler = async (req, res) => {
  const { id } = req.params;
  if (typeof id !== "string") {
    res.status(400).json({
      error: {
        message: "Invalid token ID",
        type: "invalid_request_error",
        code: "INVALID_TOKEN_ID",
      },
    });
    return;
  }

  const deleted = await GatewayToken.findOneAndDelete({
    _id: id,
    userId: res.locals.userId,
  }).exec();

  if (!deleted) {
    res.status(404).json({
      error: {
        message: "Token not found",
        type: "not_found",
        code: "TOKEN_NOT_FOUND",
      },
    });
    return;
  }

  res.status(204).end();
};
