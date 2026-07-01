import { ValidateGrpcPayload } from '@backend/grpc';
import {
  GrpcImageAdminServiceController,
  GrpcImageAdminTransport,
  NestCommon,
  NestStorage,
} from '@backend/proto';
import { GetListDto } from '@common/application/dto/get-list.dto';
import { IdFieldDto } from '@common/application/dto/id-field.dto';
import { AdminGrpcController } from '@common/interface/grpc/decorators/grpc.controller.decorator';
import { ImageCreateManyDto } from '@modules/image/application/dto/image.create-many.dto';
import { ImageCreateOneDto } from '@modules/image/application/dto/image.create.dto';
import { ImageUpdateByIdDto } from '@modules/image/application/dto/image.update.dto';
import { ImageProxyService } from '@modules/image/application/services/image.proxy.service';

@AdminGrpcController()
@GrpcImageAdminTransport.ControllerMethods()
export class GrpcImageAdminController implements GrpcImageAdminServiceController {
  constructor(private readonly imageClient: ImageProxyService) {}

  @ValidateGrpcPayload(IdFieldDto)
  getById({ id }: NestCommon.IdField): Promise<NestStorage.ImagePopulated> {
    return this.imageClient.getById(id);
  }

  @ValidateGrpcPayload(GetListDto)
  getList(request: NestCommon.GetList): Promise<NestStorage.ImageList> {
    return this.imageClient.getList(request);
  }

  @ValidateGrpcPayload(ImageCreateOneDto)
  createOne(request: NestStorage.ImageCreateOne): Promise<NestStorage.Image> {
    return this.imageClient.createOne(request);
  }

  @ValidateGrpcPayload(ImageCreateManyDto)
  createMany(request: NestStorage.ImageCreateMany): Promise<NestStorage.ImageArray> {
    return this.imageClient.createMany(request);
  }

  @ValidateGrpcPayload(ImageUpdateByIdDto)
  updateById({ id, update }: NestStorage.ImageUpdateById): Promise<NestStorage.Image> {
    return this.imageClient.updateOne({ id }, update);
  }

  @ValidateGrpcPayload(IdFieldDto)
  deleteById({ id }: NestCommon.IdField): Promise<NestStorage.Image> {
    return this.imageClient.deleteOne({ id });
  }
}
