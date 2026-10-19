import "server-only";

import mongoose from "mongoose";

type ConnectionCache = { promise: Promise<typeof mongoose> | null };
// Keyed to this Mongoose instance, not to globalThis: instrumentation (event handlers, the reminder scheduler) and
// the app can load separate copies of Mongoose in one process, and a shared slot let one copy hand the other an
// unrelated connection, leaving its own models unconnected. The instance survives development reloads.
const slot = Symbol.for("redline.db");
const holder = mongoose as typeof mongoose & { [slot]?: ConnectionCache };
const cache = (holder[slot] ??= { promise: null });

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
