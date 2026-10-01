import { getShortcutKey } from './shortcut-key';

describe('getShortcutKey', () => {
  it('answers a Latin letter lowercased', () => {
    expect(getShortcutKey({ key: 'a', code: 'KeyA' })).toBe('a');
    expect(getShortcutKey({ key: 'F', code: 'KeyF' })).toBe('f');
  });

  it('answers the letter at the key’s place when the layout types another script', () => {
    // ЙЦУКЕН: the key printed "F" types "а", the one printed "A" types "ф".
    expect(getShortcutKey({ key: 'А', code: 'KeyF' })).toBe('f');
    expect(getShortcutKey({ key: 'ф', code: 'KeyA' })).toBe('a');
  });

  it('keeps the letter typed on a Latin layout that moves it', () => {
    // AZERTY: "a" sits where QWERTY has "q".
    expect(getShortcutKey({ key: 'a', code: 'KeyQ' })).toBe('a');
  });

  it('answers the letter under a modifier that changes what the key types', () => {
    // macOS: Option+F types "ƒ".
    expect(getShortcutKey({ key: 'ƒ', code: 'KeyF' })).toBe('f');
  });

  it('leaves every other key as it is', () => {
    expect(getShortcutKey({ key: 'ArrowDown', code: 'ArrowDown' })).toBe('ArrowDown');
    expect(getShortcutKey({ key: 'F2', code: 'F2' })).toBe('F2');
    expect(getShortcutKey({ key: ' ', code: 'Space' })).toBe(' ');
    expect(getShortcutKey({ key: '1', code: 'Digit1' })).toBe('1');
    expect(getShortcutKey({ key: 'Enter', code: 'NumpadEnter' })).toBe('Enter');
  });
});
