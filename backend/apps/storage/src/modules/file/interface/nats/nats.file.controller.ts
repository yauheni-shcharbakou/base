import {
  NatsController,
  NatsEvent,
  NatsStorageVideoTransport,
  NatsStorageVideoUploadFailEventHandler,
  NatsStorageVideoUploadFinishEventHandler,
} from '@backend/nats';
import { NestStorage } from '@backend/proto';
import { FileUpdateUseCase } from '@modules/file/application/use-cases/file.update.use-case';

@NatsController()
export class NatsFileController
  implements NatsStorageVideoUploadFinishEventHandler, NatsStorageVideoUploadFailEventHandler
{
  constructor(private readonly updateUseCase: FileUpdateUseCase) {}

  @NatsEvent(NatsStorageVideoTransport.UPLOAD_FAIL)
  async onStorageVideoUploadFail(event: NestStorage.Video): Promise<void> {
    await this.updateUseCase.updateById(event.fileId, {
      set: {
        uploadStatus: NestStorage.FileUploadStatus.FAILED,
      },
    });
  }

  @NatsEvent(NatsStorageVideoTransport.UPLOAD_FINISH)
  async onStorageVideoUploadFinish(event: NestStorage.Video): Promise<void> {
    await this.updateUseCase.updateById(event.fileId, {
      set: {
        uploadStatus: NestStorage.FileUploadStatus.READY,
      },
    });
  }
}
