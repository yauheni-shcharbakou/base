import { GrpcIdField } from '@backend/grpc';
import { Controller, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IMAGE_SERVICE, ImageService } from 'modules/image/service/image.service';

@Controller()
export class ImageEventController {
  constructor(@Inject(IMAGE_SERVICE) private readonly imageService: ImageService) {}

  @OnEvent('file.delete')
  async onFileDelete(payload: GrpcIdField) {
    await this.imageService.onFileDelete(payload.id);
  }
}
