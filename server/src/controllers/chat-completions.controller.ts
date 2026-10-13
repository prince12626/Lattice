import { Readable } from "node:stream";
import type { AuthenticatedHandler } from "../middleware/auth.middleware.js";
import { z } from "zod";
import { logger } from "../lib/logger.lib.js";
import { ApiProvider, decryptApiProviderKey } from "../models/api.model.js";

const requestTimeoutMs = 120_000;
const failureThreshold = 3;
const maxCooldownMs = 5 * 60_000;

const chatCompletionRequestSchema = z
  .object({
    model: z.string().trim().min(1),
    messages: z.array(z.record(z.string(), z.unknown())).min(1),
    stream: z.boolean().optional(),
  })
  .passthrough();

function sendError(
  res: Parameters<AuthenticatedHandler>[1],
  status: number,
  message: string,
  code: string,
): void {
  res.status(status).json({
    error: {
      message,
      type: status === 401 ? "authentication_error" : "api_error",
      code,
    },
  });
}

function endpointFor(baseUrl: string): string {
  const url = new URL(baseUrl);
  const normalizedPath = url.pathname.replace(/\/+$/, "");
  url.pathname = normalizedPath.endsWith("/chat/completions")
    ? normalizedPath
    : `${normalizedPath}/chat/completions`;
  return url.toString();
}

export function isAnthropicProvider(provider: {
  provider: string;
  baseUrl: string;
}): boolean {
  const providerId = provider.provider.toLowerCase();
  const { hostname, pathname } = new URL(provider.baseUrl);
  return (
    providerId.includes("anthropic") ||
    providerId.includes("claude") ||
    hostname === "api.anthropic.com" ||
    pathname.replace(/\/+$/, "").endsWith("/messages")
  );
}

export function anthropicEndpointFor(baseUrl: string): string {
  const url = new URL(baseUrl);
  const normalizedPath = url.pathname.replace(/\/+$/, "");
  url.pathname = normalizedPath.endsWith("/messages")
    ? normalizedPath
    : normalizedPath.endsWith("/v1")
      ? `${normalizedPath}/messages`
      : `${normalizedPath}/v1/messages`;
  return url.toString();
}

export function isRetryableStatus(status: number): boolean {
  return (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500
  );
}

export async function markProviderFailure(
  providerId: unknown,
  consecutiveFailures: number,
): Promise<void> {
  const failureCount = consecutiveFailures + 1;
  const cooldownMs = Math.min(
    15_000 * 2 ** Math.min(failureCount - 1, 5),
    maxCooldownMs,
  );

  await ApiProvider.updateOne(
    { _id: providerId },
    {
      $inc: { consecutiveFailures: 1 },
      $set: {
        health: failureCount >= failureThreshold ? "unavailable" : "degraded",
        lastFailureAt: new Date(),
        cooldownUntil: new Date(Date.now() + cooldownMs),
      },
    },
  ).exec();
}

export async function markProviderSuccess(providerId: unknown): Promise<void> {
  await ApiProvider.updateOne(
    { _id: providerId },
    {
      $set: {
        health: "healthy",
        consecutiveFailures: 0,
        lastUsedAt: new Date(),
        cooldownUntil: null,
      },
    },
  ).exec();
}

export const createChatCompletion: AuthenticatedHandler = async (req, res) => {
  const parsed = chatCompletionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(
      res,
      400,
      "Expected a model and a non-empty messages array",
      "INVALID_REQUEST",
    );
    return;
  }
  const completionRequest = parsed.data;

  const providers = (
    await ApiProvider.find({
      userId: res.locals.userId,
      isEnabled: true,
      $or: [
        { supportedModels: { $size: 0 } },
        { supportedModels: completionRequest.model },
      ],
    })
      .select("+apiKey")
      .sort({ priority: 1, createdAt: 1 })
      .exec()
  ).filter((provider) => !isAnthropicProvider(provider));

  if (providers.length === 0) {
    sendError(
      res,
      503,
      `No enabled provider supports model '${completionRequest.model}'`,
      "NO_PROVIDER_AVAILABLE",
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
      upstream = await fetch(endpointFor(provider.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${decryptApiProviderKey(provider)}`,
          "content-type": "application/json",
          accept: completionRequest.stream
            ? "text/event-stream"
            : "application/json",
        },
        body: JSON.stringify(completionRequest),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      lastFailure = error;
      await markProviderFailure(provider._id, provider.consecutiveFailures);
      logger.warn(
        { providerId: provider.id, err: error },
        "LLM provider request failed; trying the next provider",
      );
      continue;
    }

    if (!upstream.ok && isRetryableStatus(upstream.status)) {
      lastFailure = new Error(`Provider returned HTTP ${upstream.status}`);
      await markProviderFailure(provider._id, provider.consecutiveFailures);
      logger.warn(
        { providerId: provider.id, status: upstream.status },
        "LLM provider returned a retryable status; trying the next provider",
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
      "x-request-id",
      "openai-processing-ms",
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
        "LLM provider response stream failed",
      );
      res.destroy(error);
    });
    responseStream.pipe(res);
    return;
  }

  logger.error(
    { userId: res.locals.userId, err: lastFailure },
    "All configured LLM providers failed",
  );
  sendError(
    res,
    503,
    "All configured LLM providers are unavailable",
    "UPSTREAMS_UNAVAILABLE",
  );
};

export const listModels: AuthenticatedHandler = async (_req, res) => {
  const providers = await ApiProvider.find({
    userId: res.locals.userId,
    isEnabled: true,
    supportedModels: { $ne: [] },
  })
    .select("supportedModels")
    .exec();

  const models = [
    ...new Set(providers.flatMap(({ supportedModels }) => supportedModels)),
  ];
  res.status(200).json({
    object: "list",
    data: models.map((id) => ({ id, object: "model", owned_by: "gateway" })),
  });
};
