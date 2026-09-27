import zod from 'zod';
import { storageMetaSchema } from './storage-meta.schema';

describe('storageMetaSchema', () => {
  const schema = zod.object(storageMetaSchema);

  // No folder picked: the hidden `isPublic` checkbox never registers a value.
  it('accepts a form with no folder and no isPublic', () => {
    expect(schema.safeParse({}).success).toBe(true);
  });

  // The folder select's "None" option.
  it('accepts an empty parent', () => {
    expect(schema.safeParse({ parent: '' }).success).toBe(true);
  });

  it('accepts a folder with its visibility', () => {
    expect(schema.safeParse({ parent: 'folder-id', isPublic: true }).success).toBe(true);
  });
});
