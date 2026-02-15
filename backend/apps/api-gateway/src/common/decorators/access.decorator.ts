import { GrpcUserRole } from '@backend/grpc';
import { GrpcController } from '@backend/transport';
import { applyDecorators, SetMetadata, UseGuards, UseInterceptors } from '@nestjs/common';
import { MetadataKey } from 'common/enums/metadata.enums';
import { GrpcAccessGuard } from 'common/guards/grpc-access.guard';
import { GrpcControllerInterceptor } from 'common/interceptors/grpc.controller.interceptor';

export const SkipAuth = () => SetMetadata(MetadataKey.SKIP_AUTH, true);

export const Roles = (roles: GrpcUserRole[]) => {
  return applyDecorators(
    SetMetadata(MetadataKey.SKIP_AUTH, false),
    SetMetadata(MetadataKey.ALLOWED_ROLES, roles),
  );
};

export const AdminAccess = () => Roles([GrpcUserRole.ADMIN]);

export const DefaultGrpcController = () => {
  return applyDecorators(
    UseInterceptors(GrpcControllerInterceptor),
    UseGuards(GrpcAccessGuard),
    GrpcController(),
  );
};

export const PublicGrpcController = () => {
  return applyDecorators(SkipAuth(), DefaultGrpcController());
};

export const AdminGrpcController = () => {
  return applyDecorators(AdminAccess(), DefaultGrpcController());
};
