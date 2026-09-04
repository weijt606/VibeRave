/**
 * Per-key promise queue. `run(key, fn)` waits for every earlier `run` with
 * the same key to settle before invoking `fn`, so a session's
 * load → generate → save cycle never interleaves with another request for
 * the same session. Different keys run concurrently. Entries are dropped
 * once their queue drains, so memory stays bounded by in-flight work.
 */
export function createKeyedQueue() {
  const tails = new Map(); // key → Promise (last queued job, settled or not)
  const depth = new Map(); // key → number of jobs queued or running

  return {
    async run(key, fn) {
      const prev = tails.get(key) || Promise.resolve();
      depth.set(key, (depth.get(key) || 0) + 1);
      const job = prev.then(fn, fn); // run regardless of predecessor outcome
      // The tail must never reject, or every later job would see a rejection.
      tails.set(
        key,
        job.catch(() => {}),
      );
      try {
        return await job;
      } finally {
        const d = (depth.get(key) || 1) - 1;
        if (d <= 0) {
          depth.delete(key);
          tails.delete(key);
        } else {
          depth.set(key, d);
        }
      }
    },
    /** Number of jobs queued or running for `key`. */
    pending(key) {
      return depth.get(key) || 0;
    },
    /** Number of keys with in-flight work. */
    get size() {
      return depth.size;
    },
  };
}
