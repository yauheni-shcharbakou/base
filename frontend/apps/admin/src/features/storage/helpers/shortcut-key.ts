const LATIN_LETTER = /^[a-z]$/i;
const LETTER_CODE = /^Key([A-Z])$/;

/**
 * The key a shortcut is matched by. A letter key answers its letter, lowercased: the one it types
 * when that is Latin, else the one printed at its place on a QWERTY keyboard (`event.code`) — so "A"
 * works on a Cyrillic layout, and on AZERTY or Dvorak it stays where "A" is printed, which matching
 * by `code` alone would move. Any other key answers its `event.key`.
 */
export const getShortcutKey = ({ key, code }: Pick<KeyboardEvent, 'key' | 'code'>): string => {
  if (LATIN_LETTER.test(key)) {
    return key.toLowerCase();
  }

  const letter = LETTER_CODE.exec(code)?.[1];

  return letter ? letter.toLowerCase() : key;
};
