import { type NestStorage } from '@backend/proto';

export interface StorageObjectParentUpdateEvent {
  parent: string;
  update: Partial<Pick<NestStorage.StorageObject, 'folderPath' | 'isPublic'>>;
}

/**
 * What a purge deletes, named by the kind of object rather than by the provider that stores it —
 * which provider holds a `FILE` or a `VIDEO` is the consumer's business.
 */
export enum FilePurgeType {
  // A plain file or an image: the key is the file row's `providerId`.
  FILE = 'file',
  // A video: the key is the video row's `providerId`, never set on its backing file row.
  VIDEO = 'video',
}

/** One provider object to delete. Emitted after its rows are gone, so it carries all it needs. */
export interface FilePurgeEvent {
  type: FilePurgeType;
  providerId: string;
}
