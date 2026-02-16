import { configService } from '@/services';
import { GrpcFileServiceClient } from '@frontend/grpc';
import { ChannelCredentials } from '@grpc/grpc-js';

export const fileGrpcClient = new GrpcFileServiceClient(
  configService.getGrpcUrl(),
  ChannelCredentials.createInsecure(),
);
