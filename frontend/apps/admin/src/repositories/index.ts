import { config } from '@/config';
import { ChannelCredentials } from '@grpc/grpc-js';
import { AuthGrpcRepository, AuthServiceClient } from '@packages/grpc.js';

export const authGrpcRepository = new AuthGrpcRepository(
  new AuthServiceClient(config.backend.grpcUrl, ChannelCredentials.createInsecure()),
);
