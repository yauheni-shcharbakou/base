import { UserRole } from '@packages/grpc.js';
import { PayloadRequest } from 'payload';

export class AdminAccessGuard {
  static get onlyAdmin() {
    return ({ req }: { req: PayloadRequest }) => req.user?.['role'] === UserRole.ADMIN;
  }

  static get disabled() {
    return () => false;
  }

  static get enabled() {
    return () => true;
  }
}
