/**
 * Separates the event id from the consumer id in a subscriber queue name:
 * `auth.user.create` + `storage.file` -> `auth.user.create@storage.file`.
 *
 * `:` — the obvious choice — is rejected by BullMQ (`QueueBase` throws
 * `Queue name cannot contain :`) because it is the Redis key delimiter:
 * keys are built as `<prefix>:<queueName>:<type>`.
 */
export const QUEUE_CONSUMER_SEPARATOR = '@';

/** Lowercase dot/dash segments, e.g. `storage.file`, `storage.storage-object`. */
export const CONSUMER_ID_REG_EXP = /^[a-z0-9]+([.-][a-z0-9]+)*$/;

/** Fallback message for a failure with nothing readable in its `cause` chain. */
export const REDIS_ERROR_FALLBACK = 'Redis event handler failed';

export const buildConsumerQueueName = (eventId: string, consumerId: string): string => {
  return `${eventId}${QUEUE_CONSUMER_SEPARATOR}${consumerId}`;
};

export const isConsumerQueueName = (queueName: string): boolean => {
  return queueName.includes(QUEUE_CONSUMER_SEPARATOR);
};

export const parseConsumerQueueName = (
  queueName: string,
): { eventId: string; consumerId: string } | null => {
  const separatorIndex = queueName.indexOf(QUEUE_CONSUMER_SEPARATOR);

  if (separatorIndex < 0) {
    return null;
  }

  return {
    eventId: queueName.slice(0, separatorIndex),
    consumerId: queueName.slice(separatorIndex + QUEUE_CONSUMER_SEPARATOR.length),
  };
};

/**
 * Deterministic job id for a fanned-out copy, so a redelivered source job re-adds the same
 * ids and BullMQ drops the duplicates. The event id prefix is not decoration: BullMQ
 * rejects both purely numeric custom ids (`Custom Id cannot be integers`) and `:`, and a
 * source `job.id` is exactly a number as a string.
 */
export const buildFanOutJobId = (eventId: string, sourceJobId: string): string => {
  return `${eventId}-${sourceJobId}`;
};

export const assertConsumerId = (consumerId: string): void => {
  if (!CONSUMER_ID_REG_EXP.test(consumerId)) {
    throw new Error(
      `Invalid Redis event-bus consumer id "${consumerId}": expected lowercase segments separated by "." or "-" (e.g. "storage.file")`,
    );
  }
};
