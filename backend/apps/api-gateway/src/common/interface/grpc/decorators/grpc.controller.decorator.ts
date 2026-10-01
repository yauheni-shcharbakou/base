import { GrpcController } from '@backend/grpc';
import { AdminAccess, SkipAuth } from '@common/interface/base/decorators/access.decorator';
import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PUBLIC_THROTTLE } from '../constants/grpc.throttle.constants';
import { GrpcAccessUnaryGuard } from '../guards/grpc.access-unary.guard';
import { GrpcThrottlerGuard } from '../guards/grpc.throttler.guard';

// The order is load-bearing: the throttler counts by the `user-id` the access guard resolves.
export const DefaultGrpcController = () => {
  return applyDecorators(UseGuards(GrpcAccessUnaryGuard, GrpcThrottlerGuard), GrpcController());
};

export const PublicGrpcController = () => {
  return applyDecorators(
    SkipAuth(),
    Throttle({ default: PUBLIC_THROTTLE, read: PUBLIC_THROTTLE }),
    DefaultGrpcController(),
  );
};

export const AdminGrpcController = () => {
  return applyDecorators(AdminAccess(), DefaultGrpcController());
};
