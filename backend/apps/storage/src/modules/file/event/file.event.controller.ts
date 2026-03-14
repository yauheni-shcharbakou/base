import { Controller, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FileDeleteOneEvent, FileEventPattern } from 'common/events/file.events';
import { FILE_SERVICE, FileService } from 'modules/file/service/file.service';

@Controller()
export class FileEventController {
  constructor(@Inject(FILE_SERVICE) private readonly fileService: FileService) {}

  @OnEvent(FileEventPattern.DELETE_ONE)
  async onFileDelete(payload: FileDeleteOneEvent) {
    await this.fileService.onFileDelete(payload);
  }
}
