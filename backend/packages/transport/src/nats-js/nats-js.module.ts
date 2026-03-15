import {
  NatsJetStreamClientProxy,
  NatsJetStreamServer,
  NatsJetStreamTransport,
} from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import { DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CustomStrategy } from '@nestjs/microservices';
import { NatsJsClient } from 'nats-js/compiler';
import { NatsStrategy } from 'nats-js/compiler/strategy';
import { NatsJsConfig, natsJsConfig } from 'nats-js/nats-js.config';
import { NATS_JS_CONFIG_SERVICE, NATS_JS_MICROSERVICE_OPTIONS } from 'nats-js/nats-js.constants';
import { globalStreamRegistry } from 'nats-js/utils';

type NatsJsModuleForRootParams = {
  host: keyof NatsStrategy | string;
};

export class NatsJsModule {
  static forRoot(params: NatsJsModuleForRootParams): DynamicModule {
    return {
      imports: [
        ConfigModule.forFeature(natsJsConfig),
        NatsJetStreamTransport.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService<NatsJsConfig>) => {
            return configService.getOrThrow('getClientOptions', { infer: true })(params.host);
          },
        }),
      ],
      providers: [
        {
          provide: NATS_JS_CONFIG_SERVICE,
          useClass: ConfigService,
        },
        {
          provide: NATS_JS_MICROSERVICE_OPTIONS,
          inject: [NATS_JS_CONFIG_SERVICE],
          useFactory: (configService: ConfigService<NatsJsConfig>): CustomStrategy => {
            console.log(globalStreamRegistry.getStreams());

            const options = configService.getOrThrow('getServerOptions', { infer: true })(
              params.host,
              globalStreamRegistry.getStreams(),
            );

            return {
              strategy: new NatsJetStreamServer(options),
            };
          },
        },
        {
          provide: NatsJsClient,
          inject: [NatsJetStreamClientProxy],
          useFactory: (client: NatsJetStreamClientProxy) => {
            return new NatsJsClient(client);
          },
        },
      ],
      exports: [NATS_JS_CONFIG_SERVICE, NATS_JS_MICROSERVICE_OPTIONS, NatsJsClient],
      global: true,
      module: NatsJsModule,
    };
  }
}
