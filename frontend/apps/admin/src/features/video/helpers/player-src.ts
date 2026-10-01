type PlayerSrcOptions = {
  autoPlay?: boolean;
  // Seconds into the video to start at.
  startTime?: number;
};

/**
 * The iframe `src` for a signed embed URL: the backend's parameters — token, expiry, player options
 * — with autoplay and the start as this player wants them.
 */
export const getPlayerSrc = (
  url: string,
  { autoPlay = false, startTime }: PlayerSrcOptions = {},
) => {
  const src = new URL(url);
  src.searchParams.set('autoplay', String(autoPlay));

  if (startTime && startTime >= 1) {
    src.searchParams.set('t', String(Math.floor(startTime)));
  }

  return src.toString();
};
