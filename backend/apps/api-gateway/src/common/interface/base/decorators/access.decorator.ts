import { NestAuth } from '@backend/proto';
import { MetadataKey } from '@common/domain/enums/metadata.enums';
import { applyDecorators, SetMetadata } from '@nestjs/common';

export const SkipAuth = () => SetMetadata(MetadataKey.SKIP_AUTH, true);

export const Roles = (roles: NestAuth.UserRole[]) => {
  return applyDecorators(
    SetMetadata(MetadataKey.SKIP_AUTH, false),
    SetMetadata(MetadataKey.ALLOWED_ROLES, roles),
  );
};

export const AdminAccess = () => Roles([NestAuth.UserRole.ADMIN]);
