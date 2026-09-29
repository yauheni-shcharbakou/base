'use client';

import { getPlayerSrc } from '@/features/video/helpers/player-src';
import { useVideoPlayerUrl } from '@/features/video/hooks';
import { Box, CircularProgress, Stack, SxProps, Theme, Typography } from '@mui/material';
import type { Player } from 'player.js';
import React, { FC, RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** What the page can do to a player it keeps the keyboard from. */
export type BunnyPlayerControls = {
  togglePlay: () => void;
  seekBy: (seconds: number) => void;
  toggleMute: () => void;
};

type Props = {
  videoId: string;
  title: string;
  autoPlay?: boolean;
  // Seconds into the video to start at.
  startTime?: number;
  // The page's shortcuts keep working: the focus a click gives the player goes back to the page,
  // which then drives the player through `controlsRef` — the player's own keys go unused.
  keepPageFocus?: boolean;
  // Given, the player's own full screen is the page's to replace: it is called, with where the
  // video is, as soon as the player goes full screen, and the page's own full screen — or the
  // player unmounting — ends the player's.
  onFullscreen?: (seconds: number) => void;
  controlsRef?: RefObject<BunnyPlayerControls | null>;
  sx?: SxProps<Theme>;
};

type PlayerJs = { Player: typeof Player };

// A browser that refuses sound without a gesture refuses the unmuted start; past this, the video
// starts muted rather than not at all.
const UNMUTED_START_TIMEOUT_MS = 1500;
// How long the player may take to tell where the video is before full screen is handed over anyway,
// from the start.
const CURRENT_TIME_TIMEOUT_MS = 300;

const fill = { position: 'absolute', inset: 0 } as const;

// Loaded once, and only in the browser: the library reads `window` as it loads.
let playerJs: Promise<PlayerJs> | undefined;

const loadPlayerJs = () => {
  playerJs ??= import('player.js').then(
    (module) => (module.default ?? module) as unknown as PlayerJs,
  );
  return playerJs;
};

/**
 * A Bunny Stream video in an iframe, on its signed embed URL itself — not through the `player`
 * route, whose redirect would leave the iframe on an origin its `allow` does not cover (no
 * autoplay) and that Player.js does not post to. Player.js is the Bunny embed's control protocol:
 * the player is created before the iframe loads, so its `ready` is not missed.
 */
export const BunnyPlayer: FC<Props> = ({
  videoId,
  title,
  autoPlay = false,
  startTime,
  keepPageFocus = false,
  onFullscreen,
  controlsRef,
  sx,
}) => {
  const { data, isError, isStale, isFetching } = useVideoPlayerUrl(videoId);
  // The URL the iframe loads first stays for its life — a new one would reload it and start the
  // video over. A stale one being refetched is not loaded at all: its token may have run out.
  const [loaded, setLoaded] = useState<{ videoId: string; url: string | null }>();
  const fetched = isStale && isFetching ? undefined : data;
  const [PlayerClass, setPlayerClass] = useState<typeof Player>();
  const [isPlayerJsFailed, setPlayerJsFailed] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<Player | null>(null);

  if (fetched !== undefined && loaded?.videoId !== videoId) {
    setLoaded({ videoId, url: fetched });
  }

  const url = loaded?.videoId === videoId ? loaded.url : undefined;
  const src = useMemo(
    () => (url ? getPlayerSrc(url, { autoPlay, startTime }) : undefined),
    [url, autoPlay, startTime],
  );

  useEffect(() => {
    let isActive = true;

    loadPlayerJs()
      .then(({ Player: LoadedPlayer }) => isActive && setPlayerClass(() => LoadedPlayer))
      // Without it the player still plays, only uncontrolled.
      .catch(() => isActive && setPlayerJsFailed(true));

    return () => {
      isActive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const element = iframe.current;

    if (!PlayerClass || !element || !src) {
      return;
    }

    const player = new PlayerClass(element);
    playerRef.current = player;
    let fallback: ReturnType<typeof setTimeout> | undefined;

    const controls: BunnyPlayerControls = {
      togglePlay: () => player.getPaused((paused) => (paused ? player.play() : player.pause())),
      seekBy: (seconds) =>
        player.getCurrentTime((current) => player.setCurrentTime(Math.max(0, current + seconds))),
      toggleMute: () => player.getMuted((muted) => (muted ? player.unmute() : player.mute())),
    };

    player.on('ready', () => {
      if (controlsRef) {
        controlsRef.current = controls;
      }

      if (autoPlay) {
        player.play();
        fallback = setTimeout(
          () =>
            player.getPaused((paused) => {
              if (paused) {
                player.mute();
                player.play();
              }
            }),
          UNMUTED_START_TIMEOUT_MS,
        );
      }
    });

    return () => {
      clearTimeout(fallback);
      playerRef.current = null;

      if (controlsRef?.current === controls) {
        controlsRef.current = null;
      }
    };
  }, [PlayerClass, src, autoPlay, controlsRef]);

  // The player says nothing of its full-screen button; the browser does, once it has gone full
  // screen — the only moment to hand it over.
  useEffect(() => {
    if (!onFullscreen) {
      return;
    }

    const handleChange = () => {
      if (!iframe.current || document.fullscreenElement !== iframe.current) {
        return;
      }

      let isHandedOver = false;
      const handOver = (seconds: number) => {
        if (!isHandedOver) {
          isHandedOver = true;
          onFullscreen(seconds);
        }
      };

      playerRef.current?.getCurrentTime(handOver);
      setTimeout(() => handOver(0), CURRENT_TIME_TIMEOUT_MS);
    };

    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, [onFullscreen]);

  // Keys typed into a cross-origin iframe never reach the page: whenever the player takes the
  // focus, it goes back to the page — to this wrapper, so a dialog's focus trap still holds it.
  useEffect(() => {
    if (!keepPageFocus) {
      return;
    }

    const handleBlur = () =>
      setTimeout(() => {
        if (document.activeElement === iframe.current) {
          wrapper.current?.focus({ preventScroll: true });
        }
      });

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [keepPageFocus]);

  const renderContent = () => {
    if (src && (PlayerClass || isPlayerJsFailed)) {
      return (
        <Box
          component="iframe"
          ref={iframe}
          src={src}
          title={title}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          sx={{ ...fill, width: 1, height: 1, border: 0 }}
        />
      );
    }

    if (url === null || isError) {
      return (
        <Stack sx={fill} alignItems="center" justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Player is unavailable
          </Typography>
        </Stack>
      );
    }

    return (
      <Stack sx={fill} alignItems="center" justifyContent="center">
        <CircularProgress color="inherit" />
      </Stack>
    );
  };

  return (
    <Box
      ref={wrapper}
      tabIndex={-1}
      sx={[
        { position: 'relative', width: 1, height: 1, outline: 'none' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {renderContent()}
    </Box>
  );
};
