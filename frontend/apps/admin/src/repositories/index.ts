import { config } from '@/config';
import { ChannelCredentials } from '@grpc/grpc-js';
import {
  AuthGrpcRepository,
  AuthServiceClient,
  UserGrpcRepository,
  UserServiceClient,
} from '@frontend/grpc';

export const authGrpcRepository = new AuthGrpcRepository(
  new AuthServiceClient(config.backend.grpcUrl, ChannelCredentials.createInsecure()),
);

export const userGrpcRepository = new UserGrpcRepository(
  new UserServiceClient(config.backend.grpcUrl, ChannelCredentials.createInsecure()),
);
