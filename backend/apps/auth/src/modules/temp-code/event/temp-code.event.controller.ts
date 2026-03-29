import { GrpcIdField } from '@backend/grpc';
import { NatsTempCodeEventController, NatsTempCodeTransport } from '@backend/transport';
import { Inject } from '@nestjs/common';
import { TEMP_CODE_SERVICE, TempCodeService } from 'modules/temp-code/service/temp-code.service';
import { from, Observable } from 'rxjs';

@NatsTempCodeTransport.Controller()
export class TempCodeEventController implements NatsTempCodeEventController {
  constructor(@Inject(TEMP_CODE_SERVICE) private readonly tempCodeService: TempCodeService) {}

  onDeactivateOne(event: GrpcIdField): Observable<void> {
    return from(this.tempCodeService.onDeactivateOne(event));
  }
}
