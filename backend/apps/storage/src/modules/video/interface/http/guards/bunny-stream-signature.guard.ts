import { BunnyStorageConfig } from '@modules/storage/infrastructure/configs/bunny.storage.config';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_HEADER = 'x-bunnystream-signature';

// Only what the guard reads. Typed structurally rather than as an express `Request`, because
// `@types/express` is a devDependency and `src/` may not import one.
type SignedRequest = RawBodyRequest<{
  headers: Record<string, string | string[] | undefined>;
}>;

/**
 * Verifies the `v1` signature Bunny Stream puts on every webhook POST:
 * `lowercase_hex(HMAC-SHA256(raw_body, read-only API key))`.
 *
 * The signature covers the body alone — no timestamp, no nonce — so a captured request can be
 * replayed. That is tolerable only because the handler behind this guard is idempotent.
 */
@Injectable()
export class BunnyStreamSignatureGuard implements CanActivate {
  private readonly readOnlyApiKey: string;

  constructor(configService: ConfigService<BunnyStorageConfig>) {
    this.readOnlyApiKey = configService.getOrThrow('bunny.stream.readOnlyApiKey', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SignedRequest>();
    const signature = request.headers[SIGNATURE_HEADER];

    if (typeof signature !== 'string' || !request.rawBody?.length) {
      throw new UnauthorizedException('Missing Bunny Stream signature');
    }

    // The raw bytes, never a re-serialized body: whitespace or key order would break the digest.
    const expected = createHmac('sha256', this.readOnlyApiKey).update(request.rawBody).digest();
    const received = Buffer.from(signature, 'hex');

    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new UnauthorizedException('Invalid Bunny Stream signature');
    }

    return true;
  }
}
