import { GrpcController } from '@backend/grpc';
import { AdminAccess, SkipAuth } from '@common/interface/base/decorators/access.decorator';
import { applyDecorators, UseGuards } from '@nestjs/common';
import { GrpcAccessUnaryGuard } from '../guards/grpc.access-unary.guard';

export const DefaultGrpcController = () => {
  return applyDecorators(UseGuards(GrpcAccessUnaryGuard), GrpcController());
};

export const PublicGrpcController = () => {
  return applyDecorators(SkipAuth(), DefaultGrpcController());
};

export const AdminGrpcController = () => {
  return applyDecorators(AdminAccess(), DefaultGrpcController());
};
