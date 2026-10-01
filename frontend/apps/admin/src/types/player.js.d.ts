// Player.js (embedly) — the postMessage protocol the Bunny Stream embed speaks. Untyped upstream;
// only what the admin calls is declared.
declare module 'player.js' {
  export class Player {
    constructor(iframe: HTMLIFrameElement);
    on(
      event: 'ready' | 'play' | 'pause' | 'ended' | 'timeupdate' | 'error',
      callback: (value?: unknown) => void,
    ): void;
    off(event: string, callback?: (value?: unknown) => void): void;
    play(): void;
    pause(): void;
    mute(): void;
    unmute(): void;
    getPaused(callback: (paused: boolean) => void): void;
    getMuted(callback: (muted: boolean) => void): void;
    getCurrentTime(callback: (seconds: number) => void): void;
    setCurrentTime(seconds: number): void;
  }

  const playerjs: { Player: typeof Player };
  export default playerjs;
}
