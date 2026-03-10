import { GrpcConfigHost, GrpcConfigService } from 'grpc/grpc.config';

export type GrpcServiceDefinition = {
  package: string;
  protoPath: string;
};

export type GrpcStrategy = {
  [Host in GrpcConfigHost]?: GrpcConfigService<Host>[];
};
