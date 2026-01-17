import { DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc, ClientsModule } from '@nestjs/microservices';
import {
  GrpcProxyControllerFactoryParams,
  GrpcProxyControllerFactoryResult,
} from '@packages/grpc.nest';
import { GrpcConfigServiceDefinition, GrpcHost } from 'configs';
import { GrpcController, InjectGrpcService, ValidateGrpcPayload } from 'decorators';
import { getGrpcClientToken, getGrpcServiceToken } from 'helpers';
import _ from 'lodash';
import { GRPC_CONFIG_SERVICE } from 'modules/grpc';
import { GrpcRxPipe } from 'pipes';

export type GrpcProxyControllerFactory<DtoSchema extends object> = (
  params: GrpcProxyControllerFactoryParams<DtoSchema>,
) => GrpcProxyControllerFactoryResult;

export type GrpcProxyModuleParams<DtoSchema extends object> = {
  host: GrpcHost;
  controllerFactory: GrpcProxyControllerFactory<DtoSchema>;
  dtoSchema: DtoSchema;
  custom?: Omit<GrpcProxyControllerFactoryParams<DtoSchema>, 'dtoSchema'>;
};

export class GrpcProxyModule {
  static register<DtoSchema extends object = object>(
    params: GrpcProxyModuleParams<DtoSchema>,
  ): DynamicModule {
    const factoryResult = params.controllerFactory({
      GrpcController: params.custom?.GrpcController ?? GrpcController,
      ValidateGrpcPayload: params.custom?.ValidateGrpcPayload ?? ValidateGrpcPayload,
      InjectGrpcService: params.custom?.InjectGrpcService ?? InjectGrpcService,
      dtoSchema: params.dtoSchema,
      proxyPipes: params.custom?.proxyPipes ?? [GrpcRxPipe.proxy()],
    });

    const clientToken = getGrpcClientToken(params.host);
    const serviceToken = getGrpcServiceToken(factoryResult.service);

    return {
      imports: [
        ClientsModule.registerAsync({
          clients: [
            {
              inject: [GRPC_CONFIG_SERVICE],
              name: clientToken,
              useFactory: (configService: ConfigService) => {
                const hostConfig = configService.getOrThrow(params.host);

                const serviceDefinition: GrpcConfigServiceDefinition =
                  hostConfig.services[factoryResult.service];

                return _.merge(_.omit(hostConfig, ['services']), { options: serviceDefinition });
              },
            },
          ],
        }),
      ],
      providers: [
        {
          provide: serviceToken,
          inject: [clientToken],
          useFactory: (client: ClientGrpc) => client.getService(factoryResult.service),
        },
      ],
      controllers: [factoryResult.Controller],
      module: GrpcProxyModule,
    };
  }
}
