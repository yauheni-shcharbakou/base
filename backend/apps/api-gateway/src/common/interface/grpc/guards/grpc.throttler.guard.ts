import { MetadataKey } from '@common/domain/enums/metadata.enums';
import { Metadata, ServerUnaryCall, status } from '@grpc/grpc-js';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { isObservable } from 'rxjs';
import { CLIENT_IP_METADATA_KEY } from '../constants/grpc.throttle.constants';

interface GrpcThrottlerRequest {
  isPublic: boolean;
  metadata?: Metadata;
  peer?: string;
}

// gRPC has no response headers to write the `X-RateLimit-*` set to.
const NO_HEADERS = { header: () => undefined };

/**
 * `ThrottlerGuard` for gRPC unary calls. An authenticated call is counted per user: it relies on
 * the `user-id` metadata `GrpcAccessUnaryGuard` sets, so it must run after that guard. A public
 * call is counted per client address, since there is no user yet — and a `user-id` it arrives
 * with is the caller's own claim, not ours. Streams are not counted.
 */
@Injectable()
export class GrpcThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(
      context.getType() !== 'rpc' || isObservable(context.switchToRpc().getData()),
    );
  }

  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, any>;
    res: Record<string, any>;
  } {
    const isPublic = !!this.reflector.getAllAndOverride<boolean>(MetadataKey.SKIP_AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);

    const call: ServerUnaryCall<unknown, unknown> | undefined = context.getArgByIndex(2);

    const req: GrpcThrottlerRequest = {
      isPublic,
      metadata: context.switchToRpc().getContext<Metadata>(),
      peer: call?.getPeer?.(),
    };

    return { req, res: NO_HEADERS };
  }

  protected getTracker(req: GrpcThrottlerRequest): Promise<string> {
    return Promise.resolve(this.resolveTracker(req));
  }

  // Per caller, not per handler: the limit is on what one user or address sends in total.
  protected generateKey(_context: ExecutionContext, tracker: string, name: string): string {
    return `${name}:${tracker}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new RpcException({
      code: status.RESOURCE_EXHAUSTED,
      details: await this.getErrorMessage(context, detail),
    });
  }

  private resolveTracker(req: GrpcThrottlerRequest): string {
    const userId = req.isPublic ? undefined : this.readMetadata(req.metadata, 'user-id');

    if (userId) {
      return `user:${userId}`;
    }

    const clientIp = this.readMetadata(req.metadata, CLIENT_IP_METADATA_KEY);

    // The peer's port changes with each connection the client opens.
    return `ip:${clientIp ?? req.peer?.replace(/:\d+$/, '') ?? 'unknown'}`;
  }

  private readMetadata(metadata: Metadata | undefined, key: string): string | undefined {
    const value = metadata?.get?.(key)?.[0]?.toString().trim();
    return value || undefined;
  }
}
