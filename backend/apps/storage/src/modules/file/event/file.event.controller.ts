import { NatsJsFileEventController, NatsJsFileService, ProviderIdEvent } from '@backend/transport';
import { Inject } from '@nestjs/common';
import { FILE_SERVICE, FileService } from 'modules/file/service/file.service';

@NatsJsFileService.Controller()
export class FileEventController implements NatsJsFileEventController {
  constructor(@Inject(FILE_SERVICE) private readonly fileService: FileService) {}

  async deleteOne(event: ProviderIdEvent): Promise<void> {
    await this.fileService.onFileDelete(event);
  }
}
