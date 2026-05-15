import { GrpcConfigHost, GrpcConfigService } from '../configs';

export type GrpcServiceDefinition = {
  package: string;
  protoPath: string;
};

export type GrpcStrategy = {
  [Host in GrpcConfigHost]?: GrpcConfigService<Host>[];
};
