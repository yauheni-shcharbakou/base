import {
  assertConsumerId,
  buildConsumerQueueName,
  buildFanOutJobId,
  isConsumerQueueName,
  parseConsumerQueueName,
} from './redis.queue.constants';

describe('redis queue constants', () => {
  describe('buildConsumerQueueName', () => {
    it('appends the consumer id to the event id', () => {
      expect(buildConsumerQueueName('auth.user.create', 'storage.file')).toBe(
        'auth.user.create@storage.file',
      );
    });

    it('never produces the ":" BullMQ rejects in a queue name', () => {
      expect(buildConsumerQueueName('auth.user.create', 'storage.file')).not.toContain(':');
    });
  });

  describe('parseConsumerQueueName', () => {
    it('round-trips a built queue name', () => {
      const queueName = buildConsumerQueueName('auth.user.create', 'storage.file');

      expect(isConsumerQueueName(queueName)).toBe(true);
      expect(parseConsumerQueueName(queueName)).toEqual({
        eventId: 'auth.user.create',
        consumerId: 'storage.file',
      });
    });

    it('returns null for a bare event id', () => {
      expect(isConsumerQueueName('auth.user.create')).toBe(false);
      expect(parseConsumerQueueName('auth.user.create')).toBeNull();
    });
  });

  describe('buildFanOutJobId', () => {
    // BullMQ rejects a purely numeric custom id, and a source `job.id` is exactly that.
    it('prefixes the numeric source job id so it is no longer an integer', () => {
      const jobId = buildFanOutJobId('auth.user.create', '42');

      expect(jobId).toBe('auth.user.create-42');
      expect(Number.isNaN(Number(jobId))).toBe(true);
    });

    it('is deterministic, so a redelivered job re-adds the same id', () => {
      expect(buildFanOutJobId('auth.user.create', '42')).toBe(
        buildFanOutJobId('auth.user.create', '42'),
      );
    });
  });

  describe('assertConsumerId', () => {
    it('accepts lowercase dot/dash segments', () => {
      expect(() => assertConsumerId('storage.storage-object')).not.toThrow();
    });

    it.each(['Storage.File', 'storage file', 'storage..file', 'storage.'])(
      'rejects "%s"',
      (consumerId) => {
        expect(() => assertConsumerId(consumerId)).toThrow('Invalid Redis event-bus consumer id');
      },
    );
  });
});
