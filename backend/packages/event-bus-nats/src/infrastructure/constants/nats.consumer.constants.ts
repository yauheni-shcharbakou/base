/**
 * Separates the subject from the consumer id in a Nest event pattern:
 * `auth-user-create` + `storage.file` -> `auth-user-create@storage.file`.
 *
 * Unlike the Redis adapter — where the same suffix names a real BullMQ queue — this string
 * never reaches NATS. It only keeps Nest's `messageHandlers` map from collapsing two
 * controllers that subscribe to the same subject; the server strategy splits it back into
 * the subject and the durable name before touching JetStream.
 */
export const CONSUMER_SEPARATOR = '@';

/** Lowercase dot/dash segments, e.g. `storage.file`, `storage.storage-object`. */
export const CONSUMER_ID_REG_EXP = /^[a-z0-9]+([.-][a-z0-9]+)*$/;

/** Fallback message for a failure with nothing readable in its `cause` chain. */
export const NATS_ERROR_FALLBACK = 'NATS event handler failed';

/** `.`, `*`, `>`, `/`, `\` and whitespace are rejected by JetStream in a consumer name. */
const DURABLE_FORBIDDEN_REG_EXP = /[.*>/\\\s]+/g;

export const buildConsumerPattern = (subject: string, consumerId: string): string => {
  return `${subject}${CONSUMER_SEPARATOR}${consumerId}`;
};

export const isConsumerPattern = (pattern: string): boolean => {
  return pattern.includes(CONSUMER_SEPARATOR);
};

export const parseConsumerPattern = (
  pattern: string,
): { subject: string; consumerId: string } | null => {
  const separatorIndex = pattern.indexOf(CONSUMER_SEPARATOR);

  if (separatorIndex < 0) {
    return null;
  }

  return {
    subject: pattern.slice(0, separatorIndex),
    consumerId: pattern.slice(separatorIndex + CONSUMER_SEPARATOR.length),
  };
};

/**
 * Durable name of the consumer backing one subscription. Scoping it by both the consumer id
 * and the subject is the whole point of this adapter: two controllers on the same subject get
 * two independent durables, so JetStream fans the event out to both instead of load-balancing
 * it across one shared consumer.
 */
export const buildDurableName = (subject: string, consumerId: string): string => {
  return `${consumerId}-${subject}`.replace(DURABLE_FORBIDDEN_REG_EXP, '-');
};

export const assertConsumerId = (consumerId: string): void => {
  if (!CONSUMER_ID_REG_EXP.test(consumerId)) {
    throw new Error(
      `Invalid NATS event-bus consumer id "${consumerId}": expected lowercase segments separated by "." or "-" (e.g. "storage.file")`,
    );
  }
};
