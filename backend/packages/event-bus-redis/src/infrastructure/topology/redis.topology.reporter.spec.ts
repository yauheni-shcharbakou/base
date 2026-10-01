import { Logger } from '@nestjs/common';
import type { RedisMediatorService } from '../mediators';
import { RedisQueueRegistry } from '../utils';
import { RedisTopologyReporter } from './redis.topology.reporter';

type ReporterParams = {
  mediatorWorkers?: number;
  consumerWorkers?: number;
  onlyEmitting?: boolean;
};

const buildReporter = ({
  mediatorWorkers = 0,
  consumerWorkers = 0,
  onlyEmitting,
}: ReporterParams): RedisTopologyReporter => {
  const registry = new RedisQueueRegistry();

  for (let index = 0; index < consumerWorkers; index += 1) {
    registry.append({
      eventId: `auth.user.event-${index}`,
      consumerId: 'storage.file',
      queueName: `auth.user.event-${index}@storage.file`,
    });
  }

  return new RedisTopologyReporter({
    registry,
    onlyEmitting,
    host: 'storage',
    mediator: {
      getWorkerCount: () => mediatorWorkers,
    } as unknown as RedisMediatorService,
  });
};

describe('RedisTopologyReporter', () => {
  describe('getTopology', () => {
    it('counts one connection per worker, plus the shared one and the channel', () => {
      const topology = buildReporter({ mediatorWorkers: 4, consumerWorkers: 4 }).getTopology();

      expect(topology).toEqual({
        mediatorWorkers: 4,
        consumerWorkers: 4,
        workers: 8,
        connections: 10,
      });
    });

    // The shared connection and the invalidation channel exist even in a process that runs
    // no workers at all.
    it('counts the two fixed connections with no workers around', () => {
      expect(buildReporter({}).getTopology().connections).toBe(2);
    });

    // An emit-only process never starts the server strategy, so its registered subscriptions
    // (if any class happened to be loaded) cost nothing.
    it('reports no consumer workers in emit-only mode', () => {
      const topology = buildReporter({
        onlyEmitting: true,
        mediatorWorkers: 4,
        consumerWorkers: 4,
      }).getTopology();

      expect(topology.consumerWorkers).toBe(0);
      expect(topology.workers).toBe(4);
    });
  });

  describe('onApplicationBootstrap', () => {
    it('logs the counts as an estimate, with the breakdown', () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      buildReporter({ mediatorWorkers: 4, consumerWorkers: 4 }).onApplicationBootstrap();

      expect(log).toHaveBeenCalledWith(
        'Topology of host "storage": 4 mediator worker(s), 4 consumer worker(s), ' +
          '~10 connection(s) (1 shared + 1 invalidation channel + 1 per worker)',
      );

      log.mockRestore();
    });
  });
});
