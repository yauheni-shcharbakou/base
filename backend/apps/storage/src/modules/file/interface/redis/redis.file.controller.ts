import { NestAuth, NestStorage } from '@backend/proto';
import {
  RedisController,
  RedisEvent,
  RedisUserDeleteEventHandler,
  RedisUserTransport,
  RedisVideoTransport,
  RedisVideoUploadedEventHandler,
  RedisVideoUploadFailEventHandler,
  RedisVideoUploadFinishEventHandler,
} from '@backend/event-bus-redis';
import { FileDeleteByOwnerUseCase } from '@modules/file/application/use-cases/file.delete-by-owner.use-case';
import { FileUpdateUseCase } from '@modules/file/application/use-cases/file.update.use-case';

@RedisController({ consumer: 'storage.file' })
export class RedisFileController
  implements
    RedisVideoUploadedEventHandler,
    RedisVideoUploadFinishEventHandler,
    RedisVideoUploadFailEventHandler,
    RedisUserDeleteEventHandler
{
  constructor(
    private readonly updateUseCase: FileUpdateUseCase,
    private readonly deleteByOwnerUseCase: FileDeleteByOwnerUseCase,
  ) {}

  @RedisEvent(RedisVideoTransport.UPLOADED)
  async onVideoUploaded(event: NestStorage.Video): Promise<void> {
    // PENDING is the only status UPLOADED may follow, and the query — not a read-then-write — is
    // what enforces it. The three video events land in three independent queues with independent
    // retry ladders and no ordering between them, so a redelivered `uploaded` can arrive after
    // `upload.finish`; an unconditional set would demote a READY row and hide the player on an
    // already-encoded video. A miss is the normal outcome, so the left is left unthrown: raising it
    // would burn ten BullMQ attempts and park the job in the DLQ over correct behaviour.
    await this.updateUseCase.updateOne(
      { id: event.fileId, uploadStatus: NestStorage.FileUploadStatus.PENDING },
      { set: { uploadStatus: NestStorage.FileUploadStatus.UPLOADED } },
    );
  }

  @RedisEvent(RedisVideoTransport.UPLOAD_FAIL)
  async onVideoUploadFail(event: NestStorage.Video): Promise<void> {
    await this.updateUseCase.updateById(event.fileId, {
      set: {
        uploadStatus: NestStorage.FileUploadStatus.FAILED,
      },
    });
  }

  @RedisEvent(RedisVideoTransport.UPLOAD_FINISH)
  async onVideoUploadFinish(event: NestStorage.Video): Promise<void> {
    await this.updateUseCase.updateById(event.fileId, {
      set: {
        uploadStatus: NestStorage.FileUploadStatus.READY,
      },
    });
  }

  @RedisEvent(RedisUserTransport.DELETE)
  async onUserDelete(event: NestAuth.User): Promise<void> {
    const result = await this.deleteByOwnerUseCase.execute(event.id);

    // Thrown so BullMQ retries: the user is gone, so nothing else ever reaches the rest.
    if (result.isLeft()) {
      throw result.value;
    }
  }
}
