import { BaseRpcContext } from '@nestjs/microservices';
import { Job } from 'bullmq';
import { RedisQueueSubscription } from '@/infrastructure';

type RedisJobContextArgs = [Job, RedisQueueSubscription];

/**
 * Second argument of every Redis event handler — the counterpart of
 * `NatsJetStreamContext`. There is no ack/nak here: a rejected processor marks the job
 * failed and BullMQ retries it on its own.
 */
export class RedisJobContext extends BaseRpcContext<RedisJobContextArgs> {
  constructor(args: RedisJobContextArgs) {
    super(args);
  }

  getJob<Event = any>(): Job<Event> {
    return this.args[0];
  }

  getSubscription(): RedisQueueSubscription {
    return this.args[1];
  }

  getQueueName(): string {
    return this.args[1].queueName;
  }

  getEventId(): string {
    return this.args[1].eventId;
  }

  getConsumerId(): string {
    return this.args[1].consumerId;
  }

  getAttemptsMade(): number {
    return this.args[0].attemptsMade;
  }
}
