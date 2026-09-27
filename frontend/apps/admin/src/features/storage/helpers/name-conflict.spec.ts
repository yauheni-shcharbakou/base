import { isNameConflict, nameConflictField } from './name-conflict';

describe('name conflict', () => {
  it('recognises the backend’s 409 and nothing else', () => {
    expect(isNameConflict({ statusCode: 409 })).toBe(true);
    // A 400 of the same call is another refusal — an invalid parent, say — not a taken name.
    expect(isNameConflict({ statusCode: 400 })).toBe(false);
    expect(isNameConflict(undefined)).toBe(false);
  });

  it('puts the refusal on the name the save set', () => {
    expect(nameConflictField({ name: 'docs', parent: 'folder' })).toBe('name');
  });

  it('puts it on the folder when the save moved the object and kept its name', () => {
    expect(nameConflictField({ parent: 'folder' })).toBe('parent');
  });
});
