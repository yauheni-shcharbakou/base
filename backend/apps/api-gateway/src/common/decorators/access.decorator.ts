import { GrpcController } from '@backend/transport';
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { MetadataAccessType, MetadataKey } from 'common/enums/metadata.enums';
import { GrpcAccessGuard } from 'common/guards/grpc-access.guard';

export const PublicAccess = () => SetMetadata(MetadataKey.ACCESS_TYPE, MetadataAccessType.PUBLIC);
export const AdminAccess = () => SetMetadata(MetadataKey.ACCESS_TYPE, MetadataAccessType.ADMIN);

export const DefaultGrpcController = () => {
  return applyDecorators(UseGuards(GrpcAccessGuard), GrpcController());
};

export const PublicGrpcController = () => {
  return applyDecorators(PublicAccess(), DefaultGrpcController());
};

export const AdminGrpcController = () => {
  return applyDecorators(AdminAccess(), DefaultGrpcController());
};
