import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcVideoWebServiceController,
  GrpcVideoWebTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { GetUrlMapShortDto } from '@common/application/dto/storage/get-url-map.dto';
import { DefaultGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { GrpcUserId } from '@common/interface/grpc/decorators/grpc.user-id.decorator';
import { VideoCreateManyWebDto } from '@modules/video/application/dto/video.create-many.dto';
import { VideoCreateOneWebDto } from '@modules/video/application/dto/video.create.dto';
import { VideoUpdateByIdDto } from '@modules/video/application/dto/video.update.dto';
import { VideoProxyService } from '@modules/video/application/services/video.proxy.service';
import { Payload } from '@nestjs/microservices';

@DefaultGrpcController()
@GrpcVideoWebTransport.ControllerMethods()
export class GrpcVideoWebController implements GrpcVideoWebServiceController {
  constructor(private readonly videoService: VideoProxyService) {}

  @ValidateGrpcPayload(GetUrlMapShortDto)
  getUrlMap(
    @Payload() { ip, ...query }: NestStorage.GetUrlMapShort,
    @GrpcUserId() userId: string,
  ): Promise<NestCommon.StringMap> {
    return this.videoService.getUrlMap(query, ip, userId);
  }

  @ValidateGrpcPayload(GetUrlMapShortDto)
  getDownloadMap(
    @Payload() { ip, ...query }: NestStorage.GetUrlMapShort,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.DownloadMap> {
    return this.videoService.getDownloadMap(query, ip, userId);
  }

  @ValidateGrpcPayload(VideoCreateOneWebDto)
  createOne(
    @Payload() { file, storage, video }: NestStorage.VideoCreateOneWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.VideoCreated> {
    return this.videoService.createOne({ userId, file, storage, video });
  }

  @ValidateGrpcPayload(VideoCreateManyWebDto)
  createMany(
    @Payload() { items, storage }: NestStorage.VideoCreateManyWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.VideoCreatedArray> {
    return this.videoService.createMany({ userId, items, storage });
  }

  @ValidateGrpcPayload(VideoUpdateByIdDto)
  updateById(
    @Payload() { id, update }: NestStorage.VideoUpdateById,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.Video> {
    return this.videoService.updateOne({ id, userId }, update);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById(
    @Payload() { id }: NestCommon.IdField,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.Video> {
    return this.videoService.deleteOne({ id, userId });
  }
}
