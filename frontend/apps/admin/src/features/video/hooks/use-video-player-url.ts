import { createBatchLoader } from '@/common/helpers/batch-loader';
import { unwrapActionResult } from '@/features/grpc/helpers/unwrap-action-result';
import { getVideoPlayerUrls } from '@/features/video/actions/player.actions';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// Well short of the embed token's life (`BUNNY_STREAM_CDN_EXPIRES_IN_MINUTES`, an hour by default):
// coming back to a video reuses its URL instead of spending a gateway call.
const STALE_TIME_MS = 5 * 60_000;
const MAX_RETRIES = 2;

// A 4xx answers the same on every try.
const shouldRetry = (failureCount: number, error: Error) => {
  const { statusCode } = error as Error & { statusCode?: number };
  return !(statusCode && statusCode < 500) && failureCount < MAX_RETRIES;
};

// Every URL asked for at once — a page prefetching its videos, retries — is one gateway call.
const playerUrlLoader = createBatchLoader(async (videoIds) =>
  unwrapActionResult(await getVideoPlayerUrls(videoIds)),
);

const playerUrlQuery = (videoId: string) =>
  queryOptions({
    queryKey: ['video-player-url', videoId],
    queryFn: () => playerUrlLoader.load(videoId),
    staleTime: STALE_TIME_MS,
    retry: shouldRetry,
    // A new URL would reload the iframe and start the video over: a URL is refetched only when a
    // player mounts on a stale one.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

/** A video's signed embed URL — `null` for one without a player yet. */
export const useVideoPlayerUrl = (videoId: string) => useQuery(playerUrlQuery(videoId));

/**
 * Loads the embed URLs of the videos a page may play, together: stepping from one to the next then
 * starts its player without a gateway call. Fresh URLs are not asked for again.
 */
export const usePrefetchVideoPlayerUrls = (videoIds: string[]) => {
  const queryClient = useQueryClient();
  const key = videoIds.join(',');

  useEffect(() => {
    if (!key) {
      return;
    }

    key.split(',').forEach((videoId) => queryClient.prefetchQuery(playerUrlQuery(videoId)));
  }, [queryClient, key]);
};
