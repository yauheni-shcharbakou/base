import { IsExistsUseCase } from '@backend/common';
import {
  StorageObjectQuery,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageObjectIsExistsUseCase extends IsExistsUseCase<StorageObjectQuery> {
  constructor(protected readonly repository: StorageObjectRepository) {
    super(repository);
  }
}
