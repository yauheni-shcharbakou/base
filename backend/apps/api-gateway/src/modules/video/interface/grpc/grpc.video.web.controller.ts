import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcVideoWebServiceController,
  GrpcVideoWebTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { GetUrlMapWebDto } from '@common/application/dto/storage/get-url-map.dto';
import { DefaultGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { GrpcStreamMethod } from '@common/interface/grpc/decorators/grpc.stream-method.decorator';
import { GrpcUserId } from '@common/interface/grpc/decorators/grpc.user-id.decorator';
import { VideoCreateManyWebDto } from '@modules/video/application/dto/video.create-many.dto';
import { VideoCreateOneWebDto } from '@modules/video/application/dto/video.create.dto';
import { VideoUpdateByIdDto } from '@modules/video/application/dto/video.update.dto';
import { VideoProxyService } from '@modules/video/application/services/video.proxy.service';
import { Observable } from 'rxjs';

@DefaultGrpcController()
@GrpcVideoWebTransport.ControllerMethods()
export class GrpcVideoWebController implements GrpcVideoWebServiceController {
  constructor(private readonly videoService: VideoProxyService) {}

  @ValidateGrpcPayload(GetUrlMapWebDto)
  getUrlMap(
    { ip, ...query }: NestStorage.GetUrlMapWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestCommon.StringMap> {
    return this.videoService.getUrlMap(query, userId, ip);
  }

  @ValidateGrpcPayload(GetUrlMapWebDto)
  getDownloadMap(
    { ip, ...query }: NestStorage.GetUrlMapWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.DownloadMap> {
    return this.videoService.getDownloadMap(query, userId, ip);
  }

  @ValidateGrpcPayload(VideoCreateOneWebDto)
  createOne(
    { file, storage, video }: NestStorage.VideoCreateOneWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.Video> {
    return this.videoService.createOne({ userId, file, storage, video });
  }

  @ValidateGrpcPayload(VideoCreateManyWebDto)
  createMany(
    { items, storage }: NestStorage.VideoCreateManyWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.VideoArray> {
    return this.videoService.createMany({ userId, items, storage });
  }

  @GrpcStreamMethod()
  uploadOne(
    request$: Observable<NestStorage.UploadOneWeb>,
    @GrpcUserId() userId: string,
  ): Observable<NestStorage.VideoUploadResponse> {
    return this.videoService.uploadOne(request$, userId);
  }

  @ValidateGrpcPayload(VideoUpdateByIdDto)
  updateById(
    { id, update }: NestStorage.VideoUpdateById,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.Video> {
    return this.videoService.updateOne({ id, userId }, update);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById({ id }: NestCommon.IdField, @GrpcUserId() userId: string): Promise<NestStorage.Video> {
    return this.videoService.deleteOne({ id, userId });
  }
}
