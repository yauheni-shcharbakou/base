import { getShortcutLabel, isApplePlatform } from './shortcut-label';

describe('isApplePlatform', () => {
  it('knows a Mac and an iOS device', () => {
    expect(isApplePlatform('MacIntel')).toBe(true);
    expect(isApplePlatform('macOS')).toBe(true);
    expect(isApplePlatform('iPhone')).toBe(true);
    expect(isApplePlatform('iPad')).toBe(true);
  });

  it('knows anything else is not', () => {
    expect(isApplePlatform('Win32')).toBe(false);
    expect(isApplePlatform('Windows')).toBe(false);
    expect(isApplePlatform('Linux x86_64')).toBe(false);
    expect(isApplePlatform('')).toBe(false);
  });
});

describe('getShortcutLabel', () => {
  it('writes ⌘ on a Mac and Ctrl elsewhere', () => {
    expect(getShortcutLabel('selectAll', true)).toBe('⌘A');
    expect(getShortcutLabel('selectAll', false)).toBe('Ctrl+A');
    expect(getShortcutLabel('goUp', true)).toBe('⌘↑');
    expect(getShortcutLabel('goUp', false)).toBe('Ctrl+↑');
  });

  it('names the Delete key where there is no ⌘⌫', () => {
    expect(getShortcutLabel('delete', true)).toBe('⌘⌫');
    expect(getShortcutLabel('delete', false)).toBe('Del');
  });

  it('spells out the keys a Mac draws', () => {
    expect(getShortcutLabel('newFolder', true)).toBe('⇧F');
    expect(getShortcutLabel('newFolder', false)).toBe('Shift+F');
    expect(getShortcutLabel('open', true)).toBe('↵');
    expect(getShortcutLabel('open', false)).toBe('Enter');
  });

  it('keeps a key that is the same everywhere', () => {
    expect(getShortcutLabel('rename', true)).toBe('F2');
    expect(getShortcutLabel('rename', false)).toBe('F2');
  });
});
