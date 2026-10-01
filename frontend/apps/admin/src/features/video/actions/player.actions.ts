'use server';

import { authService } from '@/features/auth/services';
import { runAction } from '@/features/grpc/helpers/run-action';
import { videoGrpcRepository } from '@/features/grpc/repositories';
import type { ActionResult } from '@/features/grpc/types';

/**
 * The signed embed URLs of videos, by id, for an iframe to load directly — a whole page of them in
 * one gateway call. Not through the `player` route: a redirect leaves the iframe on another origin
 * than its `src`, which drops what its `allow` grants — autoplay — and misdirects Player.js, which
 * posts to the origin of `src`. A video that does not exist or has not finished uploading is left
 * out.
 */
export async function getVideoPlayerUrls(
  videoIds: string[],
): Promise<ActionResult<Record<string, string>>> {
  return runAction(async () => {
    if (!videoIds.length) {
      return {};
    }

    const metadata = await authService.getAuthMetadata();
    const response = await videoGrpcRepository.getUrlMap({ ids: videoIds }, metadata);
    const urls: Record<string, string> = {};

    response.entries.forEach((url, id) => {
      urls[id] = url;
    });

    return urls;
  });
}
