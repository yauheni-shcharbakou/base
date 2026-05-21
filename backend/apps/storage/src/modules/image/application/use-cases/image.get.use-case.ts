import { GetUseCase } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ImageGetUseCase extends GetUseCase<NestStorage.Image, NestStorage.ImageQuery> {
  constructor(protected readonly repository: ImageRepository) {
    super(repository);
  }
}
