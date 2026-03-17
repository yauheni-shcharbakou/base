import { NatsFileEventController, NatsFileTransport, ProviderIdEvent } from '@backend/transport';
import { Inject } from '@nestjs/common';
import { FILE_SERVICE, FileService } from 'modules/file/service/file.service';
import { from, Observable } from 'rxjs';

@NatsFileTransport.Controller()
export class FileEventController implements NatsFileEventController {
  constructor(@Inject(FILE_SERVICE) private readonly fileService: FileService) {}

  onDeleteOne(event: ProviderIdEvent): Observable<void> {
    return from(this.fileService.onDeleteOne(event));
  }
}
