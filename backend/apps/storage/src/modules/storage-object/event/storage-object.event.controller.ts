import { GrpcIdField } from '@backend/grpc';
import { Controller, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  STORAGE_OBJECT_SERVICE,
  StorageObjectService,
} from 'modules/storage-object/service/storage-object.service';

@Controller()
export class StorageObjectEventController {
  constructor(
    @Inject(STORAGE_OBJECT_SERVICE) private readonly storageObjectService: StorageObjectService,
  ) {}

  @OnEvent('file.delete')
  async onFileDelete(payload: GrpcIdField) {
    await this.storageObjectService.onFileDelete(payload.id);
  }
}
