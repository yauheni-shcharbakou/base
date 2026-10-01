import { getPlayerSrc } from './player-src';

const signed =
  'https://iframe.mediadelivery.net/embed/42/abc?token=t0k&expires=1790715600&autoplay=false&muted=false';

describe('getPlayerSrc', () => {
  it('turns autoplay on and keeps the signed parameters', () => {
    const src = new URL(getPlayerSrc(signed, { autoPlay: true }));

    expect(src.origin + src.pathname).toBe('https://iframe.mediadelivery.net/embed/42/abc');
    expect(src.searchParams.get('autoplay')).toBe('true');
    expect(src.searchParams.get('token')).toBe('t0k');
    expect(src.searchParams.get('expires')).toBe('1790715600');
    expect(src.searchParams.get('muted')).toBe('false');
  });

  it('leaves autoplay off by default', () => {
    expect(new URL(getPlayerSrc(signed)).searchParams.get('autoplay')).toBe('false');
  });

  it('starts at a whole second, and at the start without one', () => {
    expect(new URL(getPlayerSrc(signed, { startTime: 42.7 })).searchParams.get('t')).toBe('42');
    expect(new URL(getPlayerSrc(signed, { startTime: 0.4 })).searchParams.has('t')).toBe(false);
    expect(new URL(getPlayerSrc(signed)).searchParams.has('t')).toBe(false);
  });
});
