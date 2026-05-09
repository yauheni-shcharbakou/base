import {
  NatsJetStreamClientProxy,
  NatsJetStreamServer,
  NatsJetStreamTransport,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CustomStrategy } from '@nestjs/microservices';
import { GeneratedNatsClientImpl, NatsClient } from 'nats_/compiler';
import { NatsStrategy } from 'nats_/compiler/strategy';
import { NatsConfig, natsConfig } from 'nats_/nats.config';
import { NATS_CLIENT, NATS_CONFIG_SERVICE, NATS_MICROSERVICE_OPTIONS } from 'nats_/nats.constants';
import { globalStreamRegistry } from 'nats_/utils';

type NatsModuleForRootParams = {
  host: keyof NatsStrategy | string;
  onlyEmitting?: boolean;
};

export class NatsModule {
  static forRoot(params: NatsModuleForRootParams): DynamicModule {
    const providers: Provider[] = [
      {
        provide: NATS_CONFIG_SERVICE,
        useClass: ConfigService,
      },
      {
        provide: NATS_CLIENT,
        inject: [NatsJetStreamClientProxy],
        useFactory: (client: NatsJetStreamClientProxy): NatsClient => {
          return new GeneratedNatsClientImpl(client);
        },
      },
    ];

    const exports: DynamicModule['exports'] = [NATS_CONFIG_SERVICE, NATS_CLIENT];

    if (!params.onlyEmitting) {
      providers.push({
        provide: NATS_MICROSERVICE_OPTIONS,
        inject: [NATS_CONFIG_SERVICE],
        useFactory: (configService: ConfigService<NatsConfig>): CustomStrategy => {
          const options = configService.getOrThrow('getServerOptions', { infer: true })(
            params.host,
            globalStreamRegistry.getStreams(),
          );

          return {
            strategy: new NatsJetStreamServer(options),
          };
        },
      });

      exports.push(NATS_MICROSERVICE_OPTIONS);
    }

    return {
      imports: [
        ConfigModule.forFeature(natsConfig),
        NatsJetStreamTransport.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService<NatsConfig>) => {
            return configService.getOrThrow('getClientOptions', { infer: true })(params.host);
          },
        }),
      ],
      providers,
      exports,
      global: true,
      module: NatsModule,
    };
  }
}
