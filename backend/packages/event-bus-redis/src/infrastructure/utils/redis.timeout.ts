/**
 * Bounds a promise that talks to Redis over the shared connection.
 *
 * That connection runs with `maxRetriesPerRequest: null` — BullMQ requires its blocking commands
 * to retry forever — and ioredis' offline queue holds everything else until the socket returns.
 * So against a dead broker nothing rejects on its own: an emit never answers its caller, and a
 * `close()` in a shutdown hook never lets the process exit. Every such call gets a deadline.
 */
export const withRedisTimeout = <Result>(
  operation: Promise<Result>,
  timeoutMs: number,
  description: string,
): Promise<Result> => {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${description} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
};
