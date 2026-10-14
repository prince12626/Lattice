import { Readable } from "node:stream";
import { z } from "zod";
import { logger } from "../lib/logger.lib.js";
import { ApiProvider, decryptApiProviderKey } from "../models/api.model.js";
import type { AuthenticatedHandler } from "../middleware/auth.middleware.js";
import {
  anthropicEndpointFor,
  isRetryableStatus,
  markProviderFailure,
  markProviderSuccess,
  supportsAnthropicMessages,
  usesBearerProviderAuth,
} from "./chat-completions.controller.js";

const requestTimeoutMs = 120_000;

const anthropicMessageRequestSchema = z
  .object({
    model: z.string().trim().min(1),
    max_tokens: z.number().int().positive(),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.union([
              z.string(),
              z.array(z.record(z.string(), z.unknown())),
            ]),
          })
          .passthrough(),
      )
      .min(1),
    stream: z.boolean().optional(),
  })
  .passthrough();

function sendAnthropicError(
  res: Parameters<AuthenticatedHandler>[1],
  status: number,
  message: string,
  type: string,
): void {
  res.status(status).json({
    type: "error",
    error: {
      type,
      message,
    },
  });
}

export const createAnthropicMessage: AuthenticatedHandler = async (
  req,
  res,
) => {
  const parsed = anthropicMessageRequestSchema.safeParse(req.body);
  const body = req.body as Record<string, unknown>;
  if (!parsed.success) {
    logger.warn(
      {
        issues: parsed.error.issues,
        bodyKeys: Object.keys(body),
        model: body.model,
        max_tokens: body.max_tokens,
        messagesType: Array.isArray(body.messages)
          ? "array"
          : typeof body.messages,
        messagesLength: Array.isArray(body.messages)
          ? body.messages.length
          : undefined,
        messageRoles: Array.isArray(body.messages)
          ? body.messages.map((message) =>
              message && typeof message === "object"
                ? (message as Record<string, unknown>).role
                : undefined,
            )
          : undefined,
      },

      "Invalid Anthropic Messages request",
    );

    sendAnthropicError(
      res,
      400,
      "Expected a model, a positive max_tokens value, and a non-empty messages array",
      "invalid_request_error",
    );
    return;
  }

  const messageRequest = parsed.data;
  const providers = (
    await ApiProvider.find({
      userId: res.locals.userId,
      isEnabled: true,
      $or: [
        { supportedModels: { $size: 0 } },
        { supportedModels: messageRequest.model },
      ],
    })
      .select("+apiKey")
      .sort({ priority: 1, createdAt: 1 })
      .exec()
  ).filter(supportsAnthropicMessages);

  if (providers.length === 0) {
    sendAnthropicError(
      res,
      503,
      `No enabled Anthropic-compatible provider supports model '${messageRequest.model}'`,
      "service_unavailable",
    );
    return;
  }

  const now = Date.now();
  const orderedProviders = [
    ...providers.filter(
      (provider) =>
        !provider.cooldownUntil || provider.cooldownUntil.getTime() <= now,
    ),
    ...providers.filter(
      (provider) =>
        provider.cooldownUntil && provider.cooldownUntil.getTime() > now,
    ),
  ];

  let lastFailure: unknown;

  for (const provider of orderedProviders) {
    let upstream: Response;
    try {
      const headers: Record<string, string> = {
        "anthropic-version": req.get("anthropic-version") ?? "2023-06-01",
        "content-type": "application/json",
        accept: messageRequest.stream
          ? "text/event-stream"
          : "application/json",
      };
      const providerKey = decryptApiProviderKey(provider);
      if (usesBearerProviderAuth(provider)) {
        headers.authorization = `Bearer ${providerKey}`;
      } else {
        headers["x-api-key"] = providerKey;
      }
      const beta = req.get("anthropic-beta");
      if (beta) headers["anthropic-beta"] = beta;

      upstream = await fetch(anthropicEndpointFor(provider.baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify(messageRequest),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      lastFailure = error;
      await markProviderFailure(provider._id, provider.consecutiveFailures);
      logger.warn(
        { providerId: provider.id, err: error },
        "Anthropic provider request failed; trying the next provider",
      );
      continue;
    }

    if (!upstream.ok && isRetryableStatus(upstream.status)) {
      lastFailure = new Error(`Provider returned HTTP ${upstream.status}`);
      await markProviderFailure(provider._id, provider.consecutiveFailures);
      logger.warn(
        { providerId: provider.id, status: upstream.status },
        "Anthropic provider returned a retryable status; trying the next provider",
      );
      await upstream.body?.cancel();
      continue;
    }

    if (!upstream.ok) {
      res.status(upstream.status);
      const contentType = upstream.headers.get("content-type");
      if (contentType) res.setHeader("content-type", contentType);
      res.send(Buffer.from(await upstream.arrayBuffer()));
      return;
    }

    await markProviderSuccess(provider._id);
    res.status(upstream.status);
    res.setHeader("x-gateway-provider", provider.provider);

    for (const header of [
      "content-type",
      "cache-control",
      "anthropic-request-id",
      "request-id",
      "anthropic-version",
    ]) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    const responseStream = Readable.fromWeb(upstream.body);
    responseStream.on("error", (error: Error) => {
      logger.error(
        { providerId: provider.id, err: error },
        "Anthropic provider response stream failed",
      );
      res.destroy(error);
    });
    responseStream.pipe(res);
    return;
  }

  logger.error(
    { userId: res.locals.userId, err: lastFailure },
    "All configured Anthropic providers failed",
  );
  sendAnthropicError(
    res,
    503,
    "All configured Anthropic providers are unavailable",
    "service_unavailable",
  );
};
