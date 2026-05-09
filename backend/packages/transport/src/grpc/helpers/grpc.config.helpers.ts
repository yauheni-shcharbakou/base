import _ from 'lodash';
import { join } from 'node:path';
import { PROTO_PATH } from '../constants';
import type { GrpcConfig, GrpcConfigHost } from '../grpc.config';
import type { GrpcServiceDefinition } from '../grpc.types';

export const getServiceDefinitions = (
  hostConfig: GrpcConfig[GrpcConfigHost],
  services: string[],
) => {
  const result = _.reduce(
    services,
    (acc: { package: Set<string>; protoPath: Set<string> }, service) => {
      const definition: GrpcServiceDefinition = hostConfig.services[service];

      if (!definition) {
        throw new Error('Service definition is required');
      }

      acc.package.add(definition.package);
      acc.protoPath.add(join(PROTO_PATH, definition.protoPath));
      return acc;
    },
    {
      package: new Set<string>(),
      protoPath: new Set<string>(),
    },
  );

  return {
    package: Array.from(result.package),
    protoPath: Array.from(result.protoPath),
  };
};
