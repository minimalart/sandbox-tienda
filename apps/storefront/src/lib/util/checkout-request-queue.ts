type ExclusiveLocks = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

/** One queue per session, with Web Locks coordinating other tabs when available.
 * Wait for the response (and its Set-Cookie) before starting the next request. */
export function createCheckoutRequestQueue() {
  const pending = new Map<string, Promise<unknown>>();
  return function run<T>(key: string, task: () => Promise<T>, locks?: ExclusiveLocks): Promise<T> {
    const previous = pending.get(key) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(() =>
      locks ? locks.request(`checkout:${key}`, task) : task(),
    );
    pending.set(key, result);
    const clean = () => { if (pending.get(key) === result) pending.delete(key); };
    void result.then(clean, clean);
    return result;
  };
}
