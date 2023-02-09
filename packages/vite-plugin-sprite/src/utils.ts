import crypto from "crypto";
import type { MaybeAsyncFunction, MaybeRegex } from "maybe-types";
import minimatch from "minimatch";

export interface SingletonPromiseReturn<T> {
  (): Promise<T>
  /**
   * Reset current staled promise.
   * Await it to have proper shutdown.
   */
  reset: () => Promise<void>
}

export function createSingletonPromise<T>(fn: MaybeAsyncFunction<T>): SingletonPromiseReturn<T> {
  let _promise: Promise<T> | undefined;

  function wrapper(this: any, ...args: any[]) {
    if (!_promise) {
      _promise = Promise.resolve(fn.call(this, ...args));
    }
    return _promise;
  }

  wrapper.reset = async () => {
    const _prev = _promise;
    _promise = undefined;
    if (_prev) {
      await _prev;
    }
  };

  return wrapper;
}

export function isMatch(path: string, ...pattern: MaybeRegex[]) {
  return pattern.some(r => {
    if (r instanceof RegExp) {
      return r.test(path);
    }
    return path.startsWith(r) || minimatch(path, r, { partial: true, matchBase: true });
  });
}

export function mapTemplate(template: string, data: Record<string, any>) {
  return template.replace(/\[(\w+)\]/g, (_, key) => data[key] ?? "");
}

export function createHash(data: Buffer, length = 8) {
  return crypto.createHash("md5").update(data).digest("hex").slice(0, length);
}
