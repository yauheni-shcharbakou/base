import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcImageWebServiceController,
  GrpcImageWebTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { DefaultGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { GrpcUserId } from '@common/interface/grpc/decorators/grpc.user-id.decorator';
import { ImageCreateManyWebDto } from '@modules/image/application/dto/image.create-many.dto';
import { ImageCreateOneWebDto } from '@modules/image/application/dto/image.create.dto';
import { ImageUpdateByIdDto } from '@modules/image/application/dto/image.update.dto';
import { ImageProxyService } from '@modules/image/application/services/image.proxy.service';
import { Payload } from '@nestjs/microservices';

@DefaultGrpcController()
@GrpcImageWebTransport.ControllerMethods()
export class GrpcImageWebController implements GrpcImageWebServiceController {
  constructor(private readonly imageService: ImageProxyService) {}

  @ValidateGrpcPayload(ImageCreateOneWebDto)
  createOne(
    @Payload() { file, storage, image }: NestStorage.ImageCreateOneWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.ImageCreated> {
    return this.imageService.createOne({ userId, file, storage, image });
  }

  @ValidateGrpcPayload(ImageCreateManyWebDto)
  createMany(
    @Payload() { items, storage }: NestStorage.ImageCreateManyWeb,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.ImageCreatedArray> {
    return this.imageService.createMany({ userId, items, storage });
  }

  @ValidateGrpcPayload(ImageUpdateByIdDto)
  updateById(
    @Payload() { id, update }: NestStorage.ImageUpdateById,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.Image> {
    return this.imageService.updateOne({ id, userId }, update);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById(
    @Payload() { id }: NestCommon.IdField,
    @GrpcUserId() userId: string,
  ): Promise<NestStorage.Image> {
    return this.imageService.deleteOne({ id, userId });
  }
}
