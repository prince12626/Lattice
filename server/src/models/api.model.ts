import mongoose, { Schema, type HydratedDocument } from "mongoose";
import { decryptSecret, encryptSecret } from "../lib/encryption.lib.js";

export const API_PROVIDER_HEALTH_STATES = [
  "unknown",
  "healthy",
  "degraded",
  "unavailable",
] as const;

export type ApiProviderHealthState =
  (typeof API_PROVIDER_HEALTH_STATES)[number];

export interface ApiProvider {
  userId: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  isEnabled: boolean;
  priority: number;
  supportedModels: string[];
  health: ApiProviderHealthState;
  consecutiveFailures: number;
  lastUsedAt: Date | null;
  lastFailureAt: Date | null;
  cooldownUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ApiProviderDocument = HydratedDocument<ApiProvider>;

export type CreateApiProviderInput = Pick<
  ApiProvider,
  "userId" | "name" | "provider" | "baseUrl"
> & {
  apiKey: string;
  isEnabled?: boolean;
  priority?: number;
  supportedModels?: string[];
};

const apiProviderSchema = new Schema<ApiProvider>(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9][a-z0-9._-]*$/,
      maxlength: 80,
    },
    apiKey: {
      type: String,
      required: true,
      select: false,
    },
    baseUrl: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value: string) {
          try {
            const url = new URL(value);
            return (
              (url.protocol === "https:" ||
                (url.protocol === "http:" &&
                  ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) &&
              url.username === "" &&
              url.password === ""
            );
          } catch {
            return false;
          }
        },
        message: "Base URL must be HTTPS (HTTP is allowed only for localhost)",
      },
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      min: 0,
      max: 1000,
      default: 100,
    },
    supportedModels: {
      type: [String],
      default: [],
      validate: {
        validator(models: string[]) {
          return models.every((model) => model.trim().length > 0);
        },
        message: "Supported model names cannot be empty",
      },
    },
    health: {
      type: String,
      enum: API_PROVIDER_HEALTH_STATES,
      default: "unknown",
    },
    consecutiveFailures: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    lastFailureAt: {
      type: Date,
      default: null,
    },
    cooldownUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "api_providers",
    toJSON: {
      transform(_document, result: Record<string, unknown>) {
        delete result.apiKey;
        return result;
      },
    },
    toObject: {
      transform(_document, result: Record<string, unknown>) {
        delete result.apiKey;
        return result;
      },
    },
  },
);

apiProviderSchema.index({ userId: 1, name: 1 }, { unique: true });
apiProviderSchema.index({ userId: 1, isEnabled: 1, priority: 1 });

export const ApiProvider =
  (mongoose.models.ApiProvider as mongoose.Model<ApiProvider> | undefined) ??
  mongoose.model<ApiProvider>("ApiProvider", apiProviderSchema);

export async function createApiProvider(
  input: CreateApiProviderInput,
): Promise<ApiProviderDocument> {
  const { apiKey, ...provider } = input;

  return ApiProvider.create({
    ...provider,
    apiKey: encryptSecret(apiKey),
  });
}

export function decryptApiProviderKey(
  apiProvider: Pick<ApiProvider, "apiKey">,
): string {
  return decryptSecret(apiProvider.apiKey);
}
