import { DynamicModule, Type } from '@nestjs/common';
import { GrpcProxyControllerFactory, GrpcProxyControllerFactoryParams } from '@backend/grpc';
import { GrpcHost } from 'configs';
import { GrpcController, InjectGrpcService, ValidateGrpcPayload } from 'decorators';
import _ from 'lodash';
import { GrpcModule } from 'modules/grpc';
import { GrpcRxPipe } from 'pipes';

export type GrpcProxyControllerParams = {
  host: GrpcHost;
  controllerFactory: GrpcProxyControllerFactory;
  custom?: Partial<GrpcProxyControllerFactoryParams>;
};

type ControllerAccumulator = {
  controllers: Type[];
  strategy: {
    [Host in GrpcHost]?: any[];
  };
};

export class GrpcProxyModule {
  static register(...params: GrpcProxyControllerParams[]): DynamicModule {
    const controllerAccumulator = _.reduce(
      params,
      (acc: ControllerAccumulator, controllerParams) => {
        const factoryResult = controllerParams.controllerFactory({
          GrpcController: controllerParams.custom?.GrpcController ?? GrpcController,
          ValidateGrpcPayload: controllerParams.custom?.ValidateGrpcPayload ?? ValidateGrpcPayload,
          InjectGrpcService: controllerParams.custom?.InjectGrpcService ?? InjectGrpcService,
          proxyPipes: controllerParams.custom?.proxyPipes ?? [GrpcRxPipe.rpcException],
        });

        const hostServices = acc.strategy[controllerParams.host];

        if (_.isArray(hostServices)) {
          hostServices.push(factoryResult.service);
        } else {
          acc.strategy[controllerParams.host] = [factoryResult.service];
        }

        acc.controllers.push(factoryResult.Controller);
        return acc;
      },
      { controllers: [], strategy: {} },
    );

    return {
      imports: [GrpcModule.forFeature({ strategy: controllerAccumulator.strategy })],
      controllers: controllerAccumulator.controllers,
      module: GrpcProxyModule,
    };
  }
}
