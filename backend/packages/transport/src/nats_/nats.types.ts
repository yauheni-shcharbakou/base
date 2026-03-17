import { NatsStreamConfig } from '@nestjs-plugins/nestjs-nats-jetstream-transport';

export type NatsStreamData = Pick<NatsStreamConfig, 'name' | 'subjects'>;
