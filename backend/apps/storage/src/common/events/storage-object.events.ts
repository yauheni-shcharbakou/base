export enum StorageObjectEventPattern {
  UPDATE_IS_PUBLIC = 'storage.object.update.is.public',
}

export class StorageObjectUpdateIsPublicEvent {
  constructor(
    public readonly parent: string,
    public readonly isPublic: boolean,
  ) {}
}
