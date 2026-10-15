import "server-only";

import { randomUUID } from "node:crypto";
import type { AppEvent, EventName, EventPayloads } from "./event-contract";
export type { AppEvent, EventName, EventPayloads } from "./event-contract";

type Handler<K extends EventName> = (event: AppEvent<K>) => void | Promise<void>;
// Each registration gets its own wrapper, so re-registering the same function under a key
// cannot be removed by the earlier registration's unsubscribe.
type Registration<K extends EventName> = { handler: Handler<K> };
type ListenerMap = { [K in EventName]?: Map<string, Registration<K>> };

export function createEventBus() {
  const listeners: ListenerMap = {};

  /** A stable key replaces a handler on hot reload. Returns an unsubscribe function. */
  function on<K extends EventName>(name: K, key: string, handler: Handler<K>) {
    const handlers = (listeners[name] ??= new Map()) as Map<string, Registration<K>>;
    const registration = { handler };
    handlers.set(key, registration);
    return () => {
      if (handlers.get(key) === registration) handlers.delete(key);
    };
  }

  /** Await all handlers before a request ends; one failure does not skip other handlers. */
  async function emit<K extends EventName>(name: K, payload: EventPayloads[K]) {
    const event: AppEvent<K> = Object.freeze({
      id: randomUUID(), name, occurredAt: new Date().toISOString(),
      payload: Object.freeze({ ...payload }),
    });
    const handlers = [...(listeners[name]?.values() ?? [])].map((entry) => entry.handler) as Handler<K>[];
    const results = await Promise.allSettled(handlers.map(async (handler) => handler(event)));
    const errors = results.filter((result) => result.status === "rejected");
    if (errors.length) {
      throw new AggregateError(errors.map((result) => result.reason), `Handlers failed for ${name}`);
    }
    return event;
  }

  return { on, emit };
}

const globalEvents = globalThis as typeof globalThis & { redlineEvents?: ReturnType<typeof createEventBus> };
export const { on, emit } = (globalEvents.redlineEvents ??= createEventBus());
