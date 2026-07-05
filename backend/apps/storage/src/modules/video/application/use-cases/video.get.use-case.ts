import { GetUseCase } from '@backend/common';
import { NestStorage } from '@backend/proto';
import { VideoRepository } from '@modules/video/domain/repositories/video.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VideoGetUseCase extends GetUseCase<NestStorage.Video, NestStorage.VideoQuery> {
  constructor(protected readonly repository: VideoRepository) {
    super(repository);
  }
}
