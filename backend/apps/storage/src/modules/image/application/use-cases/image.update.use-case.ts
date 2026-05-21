import { UpdateUseCase } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { ImageRepository } from '@modules/image/domain/repositories/image.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ImageUpdateUseCase extends UpdateUseCase<
  NestStorage.Image,
  NestStorage.ImageQuery,
  NestStorage.ImageUpdate
> {
  constructor(protected readonly repository: ImageRepository) {
    super(repository);
  }
}
