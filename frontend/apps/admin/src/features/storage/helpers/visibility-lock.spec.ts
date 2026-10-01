import { getVisibilityLock } from './visibility-lock';

describe('getVisibilityLock', () => {
  it('holds an object in a public folder public', () => {
    expect(getVisibilityLock({ isPublic: true }, false)).toEqual({
      isPublic: true,
      reason: 'Inherited from the public folder',
    });
  });

  it('leaves the choice to an object staying in a private folder', () => {
    expect(getVisibilityLock({ isPublic: false }, false)).toBeUndefined();
  });

  it('gives a moved object the visibility of its new folder, private included', () => {
    expect(getVisibilityLock({ isPublic: false }, true)?.isPublic).toBe(false);
    expect(getVisibilityLock({ isPublic: true }, true)?.isPublic).toBe(true);
  });

  // A root folder, or a folder list still loading.
  it('holds nothing while the folder is unknown', () => {
    expect(getVisibilityLock(undefined, false)).toBeUndefined();
    expect(getVisibilityLock(undefined, true)).toBeUndefined();
  });
});
