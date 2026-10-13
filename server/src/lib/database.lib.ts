import mongoose from "mongoose";
import { env } from "../config/env.config.js";
import { logger } from "./logger.lib.js";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    autoIndex: env.NODE_ENV !== "production",
  });

  logger.info("MONGODB CONNECTED");
}

export function getDatabase() {
  const database = mongoose.connection.db;

  if (!database) {
    throw new Error("MongoDB is not connected");
  }

  return database;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected");
}
