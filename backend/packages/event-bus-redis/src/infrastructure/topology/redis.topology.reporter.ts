import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RedisMediatorService } from '../mediators';
import { RedisQueueRegistry } from '../utils';

export type RedisTopologyParams = {
  host: string;
  mediator: RedisMediatorService;
  registry: RedisQueueRegistry;
  onlyEmitting?: boolean;
};

export type RedisTopology = {
  mediatorWorkers: number;
  consumerWorkers: number;
  workers: number;
  /** Estimate — see `getTopology()`. */
  connections: number;
};

/**
 * Logs how much of the Redis connection budget this process takes, once at bootstrap.
 *
 * The count grows as `events owned by the host + subscriptions of this process`, and every
 * BullMQ worker duplicates the shared connection for its blocking commands. Without this line
 * that cost is invisible, and the call on whether the fan-out topology still fits the Redis
 * plan gets made by guesswork.
 */
export class RedisTopologyReporter implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisTopologyReporter.name);

  constructor(private readonly params: RedisTopologyParams) {}

  /**
   * Counts what the process is configured to run, not what has already started. Nest calls the
   * bootstrap hooks of a module concurrently and the server strategy spawns its workers from
   * `listen()`, so anything read from live state here would depend on a race.
   *
   * `connections` is an estimate: BullMQ does not expose the sockets it duplicates internally,
   * so it is derived as one shared connection, one for the subscription invalidation channel
   * (the registry always opens it), and one per worker. Log it as such — it must not read like
   * a measurement.
   */
  getTopology(): RedisTopology {
    const mediatorWorkers = this.params.mediator.getWorkerCount();
    const consumerWorkers = this.params.onlyEmitting
      ? 0
      : this.params.registry.getSubscriptions().length;

    const workers = mediatorWorkers + consumerWorkers;

    return {
      mediatorWorkers,
      consumerWorkers,
      workers,
      connections: 2 + workers,
    };
  }

  onApplicationBootstrap(): void {
    const topology = this.getTopology();

    this.logger.log(
      `Topology of host "${this.params.host}": ${topology.mediatorWorkers} mediator worker(s), ` +
        `${topology.consumerWorkers} consumer worker(s), ~${topology.connections} connection(s) ` +
        `(1 shared + 1 invalidation channel + 1 per worker)`,
    );
  }
}
