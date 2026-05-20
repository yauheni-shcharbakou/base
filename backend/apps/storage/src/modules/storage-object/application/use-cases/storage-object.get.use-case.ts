import { GetUseCase } from '@backend/common';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import {
  StorageObjectQuery,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageObjectGetUseCase extends GetUseCase<StorageObject, StorageObjectQuery> {
  constructor(protected readonly repository: StorageObjectRepository) {
    super(repository);
  }
}
