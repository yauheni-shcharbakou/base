import { PostgresModule } from '@backend/persistence';
import { Module } from '@nestjs/common';
import { ImageEntity } from 'common/repositories/image/entities/image.entity';
import { IMAGE_REPOSITORY } from 'common/repositories/image/image.repository';
import { ImageRepositoryImpl } from 'common/repositories/image/impl/image.repository.impl';

@Module({
  imports: [PostgresModule.forFeature(ImageEntity)],
  providers: [
    {
      provide: IMAGE_REPOSITORY,
      useClass: ImageRepositoryImpl,
    },
  ],
  exports: [IMAGE_REPOSITORY],
})
export class ImageRepositoryModule {}
