import "server-only";

import mongoose from "mongoose";

type ConnectionCache = { promise: Promise<typeof mongoose> | null };
const globalDb = globalThis as typeof globalThis & { redlineDb?: ConnectionCache };
const cache = (globalDb.redlineDb ??= { promise: null });

/** One connection attempt per warm process, including during development reloads. */
export async function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cache.promise) {
    const uri = process.env.MONGODB_URI?.trim();
    if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
      throw new Error("Set a valid MONGODB_URI before accessing the database.");
    }
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
  }
  const pending = cache.promise;
  try {
    return await pending;
  } catch {
    // Do not leak the connection string or driver diagnostics to callers.
    throw new Error("MongoDB connection failed. Check credentials, network access, and Atlas IP access.");
  } finally {
    // Failed attempts can retry; disconnected warm instances can reconnect.
    if (cache.promise === pending) cache.promise = null;
  }
}
