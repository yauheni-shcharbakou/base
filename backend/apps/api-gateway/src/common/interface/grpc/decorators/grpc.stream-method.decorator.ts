import { MetadataKey } from '@common/domain/enums/metadata.enums';
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { GrpcAccessStreamGuard } from '../guards/grpc.access-stream.guard';

export const GrpcStreamMethod = () => {
  return applyDecorators(
    SetMetadata(MetadataKey.IS_STREAM_METHOD, true),
    UseGuards(GrpcAccessStreamGuard),
  );
};
