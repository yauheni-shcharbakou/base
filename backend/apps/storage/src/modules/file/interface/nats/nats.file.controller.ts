import {
  NatsController,
  NatsEvent,
  NatsVideoTransport,
  NatsVideoUploadFailEventHandler,
  NatsVideoUploadFinishEventHandler,
} from '@backend/nats';
import { NestStorage } from '@backend/proto';
import { FileUpdateUseCase } from '@modules/file/application/use-cases/file.update.use-case';

@NatsController()
export class NatsFileController
  implements NatsVideoUploadFinishEventHandler, NatsVideoUploadFailEventHandler
{
  constructor(private readonly updateUseCase: FileUpdateUseCase) {}

  @NatsEvent(NatsVideoTransport.UPLOAD_FAIL)
  async onVideoUploadFail(event: NestStorage.Video): Promise<void> {
    await this.updateUseCase.updateById(event.fileId, {
      set: {
        uploadStatus: NestStorage.FileUploadStatus.FAILED,
      },
    });
  }

  @NatsEvent(NatsVideoTransport.UPLOAD_FINISH)
  async onVideoUploadFinish(event: NestStorage.Video): Promise<void> {
    await this.updateUseCase.updateById(event.fileId, {
      set: {
        uploadStatus: NestStorage.FileUploadStatus.READY,
      },
    });
  }
}
