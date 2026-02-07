import { AuthService } from '@/services/auth.service';
import { ConfigService } from '@/services/config.service';
import { GrpcDataService } from '@/services/grpc-data.service';

export const configService = new ConfigService();
export const authService = new AuthService(configService);
export const grpcDataService = new GrpcDataService(configService);
