import { GrpcController } from '@backend/transport';
import { Inject } from '@nestjs/common';
import {
  ContactList,
  ContactRequest,
  ContactServiceController,
  ContactServiceControllerMethods,
} from '@packages/grpc.nest';
import {
  CONTACT_REPOSITORY,
  ContactRepository,
} from 'modules/contact/repository/contact.repository';

@GrpcController()
@ContactServiceControllerMethods()
export class ContactRpcController implements ContactServiceController {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contactRepository: ContactRepository) {}

  async getMany(request: ContactRequest): Promise<ContactList> {
    return {
      items: await this.contactRepository.getMany(request.query),
    };
  }
}
