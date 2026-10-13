import { createHash, randomBytes } from "node:crypto";
import mongoose, { Schema, type HydratedDocument } from "mongoose";

export interface GatewayToken {
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type GatewayTokenDocument = HydratedDocument<GatewayToken>;

export interface CreatedGatewayToken {
  document: GatewayTokenDocument;
  token: string;
}

const gatewayTokenSchema = new Schema<GatewayToken>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    tokenPrefix: {
      type: String,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "gateway_tokens",
  },
);

export const GatewayToken =
  (mongoose.models.GatewayToken as mongoose.Model<GatewayToken> | undefined) ??
  mongoose.model<GatewayToken>("GatewayToken", gatewayTokenSchema);

export function hashGatewayToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createGatewayToken(
  userId: string,
  name: string,
): Promise<CreatedGatewayToken> {
  const token = `lgw_${randomBytes(32).toString("base64url")}`;
  const document = await GatewayToken.create({
    userId,
    name,
    tokenHash: hashGatewayToken(token),
    tokenPrefix: token.slice(0, 12),
  });

  return { document, token };
}
