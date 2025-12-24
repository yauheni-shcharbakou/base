// import { BasePayload as OriginalPayload } from 'payload';
//
// export interface BasePayload extends OriginalPayload {
//   emailField: string;
// }

import 'payload';

declare module 'payload' {
  interface BasePayload {
    emailField?: string;
    config: BasePayload['config']['custom'] & {
      email?: string;
    };
  }
}
