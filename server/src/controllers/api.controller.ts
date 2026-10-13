import mongoose from "mongoose";
import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { ApiProvider, createApiProvider } from "../models/api.model.js";
import type { AuthenticatedHandler } from "../middleware/auth.middleware.js";
import { encryptSecret } from "../lib/encryption.lib.js";

const baseUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) &&
      url.username === "" &&
      url.password === ""
    );
  }, "Base URL must be HTTPS (HTTP is allowed only for localhost)");

const createProviderSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    provider: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9._-]*$/i)
      .max(80),
    apiKey: z.string().trim().min(1).max(4096),
    baseUrl: baseUrlSchema,
    isEnabled: z.boolean().optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    supportedModels: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

const updateProviderSchema = createProviderSchema
  .omit({ apiKey: true })
  .partial()
  .extend({
    apiKey: z.string().trim().min(1).max(4096).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one provider field must be supplied",
  });

function sendValidationError(
  res: Parameters<AuthenticatedHandler>[1],
  issues: z.ZodIssue[],
): void {
  res.status(400).json({
    error: {
      message: "Invalid provider data",
      type: "invalid_request_error",
      code: "INVALID_PROVIDER",
      details: issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function sendDuplicateNameError(
  res: Parameters<AuthenticatedHandler>[1],
): void {
  res.status(409).json({
    error: {
      message: "A provider with this name already exists",
      type: "conflict_error",
      code: "PROVIDER_NAME_EXISTS",
    },
  });
}

function isValidId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

export const listApiProviders: AuthenticatedHandler = async (_req, res) => {
  const providers = await ApiProvider.find({ userId: res.locals.userId })
    .sort({ priority: 1, createdAt: 1 })
    .exec();

  res.status(200).json({ data: providers });
};

export const createApiProviderController: AuthenticatedHandler = async (
  req,
  res,
) => {
  const parsed = createProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error.issues);
    return;
  }

  try {
    const provider = await createApiProvider({
      ...parsed.data,
      provider: parsed.data.provider.toLowerCase(),
      userId: res.locals.userId,
    });

    res.status(201).json({ data: provider });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      sendDuplicateNameError(res);
      return;
    }
    throw error;
  }
};

export const getApiProvider: AuthenticatedHandler = async (req, res) => {
  const { id } = req.params;
  if (typeof id !== "string" || !isValidId(id)) {
    res.status(400).json({
      error: {
        message: "Invalid provider ID",
        type: "invalid_request_error",
        code: "INVALID_PROVIDER_ID",
      },
    });
    return;
  }

  const provider = await ApiProvider.findOne({
    _id: id,
    userId: res.locals.userId,
  }).exec();

  if (!provider) {
    res.status(404).json({
      error: {
        message: "Provider not found",
        type: "not_found",
        code: "PROVIDER_NOT_FOUND",
      },
    });
    return;
  }

  res.status(200).json({ data: provider });
};

export const updateApiProvider: AuthenticatedHandler = async (req, res) => {
  const { id } = req.params;
  if (typeof id !== "string" || !isValidId(id)) {
    res.status(400).json({
      error: {
        message: "Invalid provider ID",
        type: "invalid_request_error",
        code: "INVALID_PROVIDER_ID",
      },
    });
    return;
  }

  const parsed = updateProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error.issues);
    return;
  }

  const update = {
    ...parsed.data,
    ...(parsed.data.provider
      ? { provider: parsed.data.provider.toLowerCase() }
      : {}),
    ...(parsed.data.apiKey
      ? { apiKey: encryptSecret(parsed.data.apiKey) }
      : {}),
  };

  try {
    const provider = await ApiProvider.findOneAndUpdate(
      { _id: id, userId: res.locals.userId },
      { $set: update },
      { new: true, runValidators: true },
    ).exec();

    if (!provider) {
      res.status(404).json({
        error: {
          message: "Provider not found",
          type: "not_found",
          code: "PROVIDER_NOT_FOUND",
        },
      });
      return;
    }

    res.status(200).json({ data: provider });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      sendDuplicateNameError(res);
      return;
    }
    throw error;
  }
};

export const deleteApiProvider: AuthenticatedHandler = async (req, res) => {
  const { id } = req.params;
  if (typeof id !== "string" || !isValidId(id)) {
    res.status(400).json({
      error: {
        message: "Invalid provider ID",
        type: "invalid_request_error",
        code: "INVALID_PROVIDER_ID",
      },
    });
    return;
  }

  const provider = await ApiProvider.findOneAndDelete({
    _id: id,
    userId: res.locals.userId,
  }).exec();

  if (!provider) {
    res.status(404).json({
      error: {
        message: "Provider not found",
        type: "not_found",
        code: "PROVIDER_NOT_FOUND",
      },
    });
    return;
  }

  res.status(204).end();
};

export const providerControllerErrorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (
    error instanceof mongoose.Error.ValidationError ||
    error instanceof mongoose.Error.CastError
  ) {
    res.status(400).json({
      error: {
        message: "Invalid provider data",
        type: "invalid_request_error",
        code: "INVALID_PROVIDER",
      },
    });
    return;
  }

  next(error);
};
