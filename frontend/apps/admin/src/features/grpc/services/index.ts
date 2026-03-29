import { configService } from '@/common/services';
import { GrpcDataService } from '@/features/grpc/services/grpc.data.service';

export const grpcDataService = new GrpcDataService(configService);
