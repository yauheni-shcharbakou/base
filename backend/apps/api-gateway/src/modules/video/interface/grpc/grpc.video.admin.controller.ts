import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcVideoAdminServiceController,
  GrpcVideoAdminTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { GetListDto } from '@common/application/dto/get-list.dto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { GetUrlMapShortDto } from '@common/application/dto/storage/get-url-map.dto';
import { AdminGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { VideoCreateManyDto } from '@modules/video/application/dto/video.create-many.dto';
import { VideoCreateOneDto } from '@modules/video/application/dto/video.create.dto';
import { VideoUpdateByIdDto } from '@modules/video/application/dto/video.update.dto';
import { VideoProxyService } from '@modules/video/application/services/video.proxy.service';

@AdminGrpcController()
@GrpcVideoAdminTransport.ControllerMethods()
export class GrpcVideoAdminController implements GrpcVideoAdminServiceController {
  constructor(private readonly videoService: VideoProxyService) {}

  @ValidateGrpcPayload(GetUrlMapShortDto)
  getUrlMap(request: NestStorage.GetUrlMapShort): Promise<NestCommon.StringMap> {
    return this.videoService.getUrlMap(request);
  }

  @ValidateGrpcPayload(GetUrlMapShortDto)
  getDownloadMap(request: NestStorage.GetUrlMapShort): Promise<NestStorage.DownloadMap> {
    return this.videoService.getDownloadMap(request);
  }

  @ValidateGrpcPayload(IdFieldDto)
  getById({ id }: NestCommon.IdField): Promise<NestStorage.VideoPopulated> {
    return this.videoService.getOne({ id });
  }

  @ValidateGrpcPayload(GetListDto)
  getList(request: NestCommon.GetList): Promise<NestStorage.VideoList> {
    return this.videoService.getList(request);
  }

  @ValidateGrpcPayload(VideoCreateOneDto)
  createOne(request: NestStorage.VideoCreateOne): Promise<NestStorage.VideoCreated> {
    return this.videoService.createOne(request);
  }

  @ValidateGrpcPayload(VideoCreateManyDto)
  createMany(request: NestStorage.VideoCreateMany): Promise<NestStorage.VideoCreatedArray> {
    return this.videoService.createMany(request);
  }

  @ValidateGrpcPayload(VideoUpdateByIdDto)
  updateById({ id, update }: NestStorage.VideoUpdateById): Promise<NestStorage.Video> {
    return this.videoService.updateOne({ id }, update);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById({ id }: NestCommon.IdField): Promise<NestStorage.Video> {
    return this.videoService.deleteOne({ id });
  }
}
