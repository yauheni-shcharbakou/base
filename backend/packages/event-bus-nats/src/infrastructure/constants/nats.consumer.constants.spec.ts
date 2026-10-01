import {
  buildConsumerPattern,
  buildDurableName,
  isConsumerPattern,
  parseConsumerPattern,
} from './nats.consumer.constants';

describe('nats consumer constants', () => {
  describe('buildDurableName', () => {
    it('replaces the characters JetStream rejects in a consumer name', () => {
      expect(buildDurableName('auth-user-create', 'storage.file')).toBe(
        'storage-file-auth-user-create',
      );
    });

    it('keeps two consumers of the same subject apart', () => {
      expect(buildDurableName('auth-user-create', 'storage.file')).not.toBe(
        buildDurableName('auth-user-create', 'storage.storage-object'),
      );
    });

    it('keeps two subjects of the same consumer apart', () => {
      expect(buildDurableName('auth-user-create', 'storage.file')).not.toBe(
        buildDurableName('auth-user-delete', 'storage.file'),
      );
    });
  });

  describe('parseConsumerPattern', () => {
    it('round-trips a built pattern', () => {
      const pattern = buildConsumerPattern('auth-user-create', 'storage.file');

      expect(isConsumerPattern(pattern)).toBe(true);
      expect(parseConsumerPattern(pattern)).toEqual({
        subject: 'auth-user-create',
        consumerId: 'storage.file',
      });
    });

    it('returns null for a bare subject', () => {
      expect(isConsumerPattern('auth-user-create')).toBe(false);
      expect(parseConsumerPattern('auth-user-create')).toBeNull();
    });
  });
});
