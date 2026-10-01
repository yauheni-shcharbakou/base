import { RpcException } from '@nestjs/microservices';
import { resolveErrorMessage } from './error.utils';

const DEFAULT_MESSAGE = 'Unknown error';

/** Stands in for MikroORM's exception, which is just an `Error` subclass. */
class DriverException extends Error {}

const withCause = <T extends Error>(error: T, cause: unknown): T => Object.assign(error, { cause });

describe('resolveErrorMessage', () => {
  describe('rejections that already carry a message', () => {
    it('takes a string rejection as the message', () => {
      expect(resolveErrorMessage('boom')).toBe('boom');
    });

    it("takes an error's own message", () => {
      expect(resolveErrorMessage(new Error('boom'))).toBe('boom');
    });

    it("takes the message of Nest's rpc rejection object", () => {
      expect(resolveErrorMessage({ status: 'error', message: 'boom' })).toBe('boom');
    });

    it('takes the message of an RpcException', () => {
      expect(resolveErrorMessage(new RpcException('boom'))).toBe('boom');
    });

    it('prefers the outer message over the cause', () => {
      expect(resolveErrorMessage(withCause(new Error('outer'), new Error('inner')))).toBe('outer');
    });
  });

  describe('message-less wrappers', () => {
    it('walks the cause chain', () => {
      const error = withCause(new DriverException(''), new Error('inner'));

      expect(resolveErrorMessage(error)).toBe('inner');
    });

    it('takes a string cause', () => {
      expect(resolveErrorMessage(withCause(new Error(''), 'inner'))).toBe('inner');
    });

    it("descends into an AggregateError's errors", () => {
      const error = new AggregateError([new Error(''), new Error('inner')], '');

      expect(resolveErrorMessage(error)).toBe('inner');
    });

    it('recovers the reason of a DriverException over an AggregateError (database down)', () => {
      const aggregate = new AggregateError(
        [
          new Error('connect ECONNREFUSED ::1:5432'),
          new Error('connect ECONNREFUSED 127.0.0.1:5432'),
        ],
        '',
      );

      const error = withCause(new DriverException(''), aggregate);

      expect(resolveErrorMessage(error)).toBe('connect ECONNREFUSED ::1:5432');
    });

    it('ignores a whitespace-only message', () => {
      expect(resolveErrorMessage(withCause(new Error('   '), new Error('inner')))).toBe('inner');
    });
  });

  describe('last resorts', () => {
    it("falls back to the error's class name", () => {
      expect(resolveErrorMessage(new DriverException(''))).toBe('DriverException');
    });

    it('does not report a plain object as "Object"', () => {
      expect(resolveErrorMessage({ status: 'error', message: '' })).toBe(DEFAULT_MESSAGE);
    });

    it('falls back for a non-object rejection', () => {
      expect(resolveErrorMessage(undefined)).toBe(DEFAULT_MESSAGE);
      expect(resolveErrorMessage(null)).toBe(DEFAULT_MESSAGE);
      expect(resolveErrorMessage('')).toBe(DEFAULT_MESSAGE);
    });

    it('honours a caller-supplied fallback', () => {
      expect(resolveErrorMessage(undefined, 'unknown error')).toBe('unknown error');
    });
  });

  describe('malformed chains', () => {
    it('survives a cyclic cause', () => {
      const error = new Error('');

      expect(resolveErrorMessage(withCause(error, error))).toBe('Error');
    });

    it('survives a cycle spanning two errors', () => {
      const outer = new Error('');
      const inner = withCause(new Error(''), outer);

      expect(resolveErrorMessage(withCause(outer, inner))).toBe('Error');
    });

    it('gives up past the depth limit instead of walking forever', () => {
      const deepest = new Error('too deep');

      const error = Array.from({ length: 12 }).reduce<Error>(
        (cause) => withCause(new Error(''), cause),
        deepest,
      );

      expect(resolveErrorMessage(error)).toBe('Error');
    });
  });
});
