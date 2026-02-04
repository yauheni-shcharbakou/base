import { GrpcController } from '@backend/transport';
import { applyDecorators, SetMetadata, UseGuards, UseInterceptors } from '@nestjs/common';
import { MetadataAccessType, MetadataKey } from 'common/enums/metadata.enums';
import { GrpcAccessGuard } from 'common/guards/grpc-access.guard';
import { GrpcControllerInterceptor } from 'common/interceptors/grpc.controller.interceptor';

export const PublicAccess = () => SetMetadata(MetadataKey.ACCESS_TYPE, MetadataAccessType.PUBLIC);
export const AdminAccess = () => SetMetadata(MetadataKey.ACCESS_TYPE, MetadataAccessType.ADMIN);

export const DefaultGrpcController = () => {
  return applyDecorators(
    UseInterceptors(GrpcControllerInterceptor),
    UseGuards(GrpcAccessGuard),
    GrpcController(),
  );
};

export const PublicGrpcController = () => {
  return applyDecorators(PublicAccess(), DefaultGrpcController());
};

export const AdminGrpcController = () => {
  return applyDecorators(AdminAccess(), DefaultGrpcController());
};
