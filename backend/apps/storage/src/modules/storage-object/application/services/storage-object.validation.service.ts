import { NestStorage } from '@backend/proto';
import { StorageObjectPlacementMeta } from '@common/domain/interfaces/storage-object.meta.interface';
import {
  StorageObjectCreate,
  StorageObjectLeafType,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';
import path from 'path';

// A placement no longer carries a path: `folderPath` is derived from the tree on read.
export type StorageObjectPlacement = {
  isPublic: boolean;
};

export type StorageObjectCreateValidated = Omit<StorageObjectCreate, 'parent'> & {
  parent: string;
};

/** Where a renamed or moved object ends up. */
export type StorageObjectNameTarget = {
  /** The object itself, which never clashes with its own name. */
  id: string;
  /** Its owner — the only tree the name is checked in. */
  userId: string;
  name: string;
  parent: string;
};

/** A new object's name, as the caller asked for it. */
export type StorageObjectNameRequest = Pick<
  NestStorage.StorageObjectCreate,
  'name' | 'type' | 'parent' | 'userId'
>;

/** Leaves placed in one folder by one create call — one name each, in the order of the items. */
export type StorageObjectLeavesRequest = {
  userId: string;
  parent: string;
  type: NestStorage.StorageObjectType;
  names: string[];
  /** What the caller asked for; a public parent overrides it (`resolveIsPublic`). */
  isPublic?: boolean;
};

/**
 * A new object's visibility. A public folder makes everything placed in it public, whatever the
 * caller asked for; in a private one the caller may still make the object public, and it is private
 * otherwise.
 */
export const resolveIsPublic = (parentIsPublic: boolean, requested?: boolean): boolean =>
  parentIsPublic || !!requested;

// A 409, not a 400: a client can tell it from every other refusal of the same call and show it on
// the name field — the admin does, and keeps no copy of the rule.
const NAME_TAKEN = 'This name is already taken in the folder';
const PARENT_NOT_FOUND = 'Parent folder not found';

type MediaField = 'file' | 'image' | 'video';

/** The media references a new storage object is saved with. */
export type StorageObjectMediaIds = Partial<Record<MediaField, string>>;

const MEDIA_FIELDS: readonly MediaField[] = ['file', 'image', 'video'];

const MEDIA_FIELD: Record<StorageObjectLeafType, MediaField> = {
  [NestStorage.StorageObjectType.FILE]: 'file',
  [NestStorage.StorageObjectType.IMAGE]: 'image',
  [NestStorage.StorageObjectType.VIDEO]: 'video',
};

/**
 * Every rule here reads the tree, so the answer holds only while the tree cannot change: callers
 * that write on it run under the owner's tree lock (`StorageObjectRepository.withTreeLock`).
 */
@Injectable()
export class StorageObjectValidationService {
  constructor(private readonly storageObjectRepository: StorageObjectRepository) {}

  /**
   * The parent has to be a live folder of the same owner. Another user's folder reads as absent,
   * like a missing or deleted one, so a caller learns nothing about ids outside its own tree.
   * `objectId` is the object being moved, if it already exists — it cannot be its own parent.
   */
  async validatePlacement(
    parent: string,
    userId: string,
    objectId?: string,
  ): Promise<Either<HttpException, StorageObjectPlacement>> {
    if (objectId && parent === objectId) {
      return left(new BadRequestException('Invalid parent'));
    }

    const parentFolder = await this.storageObjectRepository.getOne({
      id: parent,
      userId,
      type: NestStorage.StorageObjectType.FOLDER,
      isDeleted: false,
    });

    if (parentFolder.isLeft()) {
      return left(new NotFoundException(PARENT_NOT_FOUND));
    }

    return right({ isPublic: parentFolder.value.isPublic });
  }

  /**
   * For a rename or a move: the name must be free in the folder the object ends up in. Unlike
   * create, a taken file name is refused rather than suffixed: an edit applies the name it was given
   * or fails.
   */
  async validateNameIsFree(
    target: StorageObjectNameTarget,
  ): Promise<Either<HttpException, string>> {
    const isTaken = await this.isNameTaken(target);

    if (isTaken) {
      return left(new ConflictException(NAME_TAKEN));
    }

    return right(target.name);
  }

  /**
   * For a create: a taken folder name is refused, a taken file name gets a ` (n)` suffix. `reserved`
   * holds the names already given to earlier items of the same create, which are not saved yet and
   * so cannot be seen in the database.
   */
  async validateObjectName(
    createData: StorageObjectNameRequest,
    reserved: ReadonlySet<string> = new Set(),
  ): Promise<Either<HttpException, string>> {
    if (createData.type === NestStorage.StorageObjectType.FOLDER) {
      const isTaken = await this.isNameTaken({
        userId: createData.userId,
        name: createData.name,
        parent: createData.parent,
      });

      if (isTaken) {
        return left(new ConflictException(NAME_TAKEN));
      }

      return right(createData.name);
    }

    const parsedName = path.parse(createData.name);

    const savedNames = await this.storageObjectRepository.distinct('name', {
      userId: createData.userId,
      parent: createData.parent,
      nameStartsWith: parsedName.name,
      isDeleted: false,
    });

    const escapeRegexp = /[.*+?^${}()|[\]\\]/g;
    const escapedName = parsedName.name.replace(escapeRegexp, '\\$&');
    const escapedExt = parsedName.ext.replace(escapeRegexp, '\\$&');
    const re = new RegExp(`^${escapedName}(?: \\((?<num>\\d+)\\))?${escapedExt}$`);

    let maxNum = -1;
    let baseFileExists = false;

    for (const fileName of [...savedNames, ...reserved]) {
      const match = fileName.match(re);

      if (match) {
        if (!match.groups.num) {
          baseFileExists = true;

          if (maxNum < 0) {
            maxNum = 0;
          }
        } else {
          const n = parseInt(match.groups.num, 10);

          if (n > maxNum) {
            maxNum = n;
          }
        }
      }
    }

    if (!baseFileExists) {
      return right(createData.name);
    }

    return right(`${parsedName.name} (${maxNum + 1})${parsedName.ext}`);
  }

  async validateCreateData(
    createData: NestStorage.StorageObjectCreate,
  ): Promise<Either<Error, StorageObjectCreateValidated>> {
    if (!createData.parent) {
      return left(new BadRequestException('Parent is required'));
    }

    // One after the other: a name is only worth checking in a folder the caller may place into,
    // for media the caller may place.
    const placement = await this.validatePlacement(createData.parent, createData.userId);

    if (placement.isLeft()) {
      return left(placement.value);
    }

    const media = await this.validateMedia(createData);

    if (media.isLeft()) {
      return left(media.value);
    }

    const name = await this.validateObjectName(createData);

    if (name.isLeft()) {
      return left(name.value);
    }

    // Built field by field, not spread: nothing the caller sent reaches the row unchecked.
    return right({
      userId: createData.userId,
      type: createData.type,
      parent: createData.parent,
      isPublic: resolveIsPublic(placement.value.isPublic, createData.isPublic),
      name: name.value,
      isFolder: createData.type === NestStorage.StorageObjectType.FOLDER,
      ...media.value,
    });
  }

  /**
   * The media a new leaf places, as the row references it. A folder takes none. A leaf takes the
   * media of its own type, which the owner holds, nothing places yet and is READY; an image or a
   * video also references its backing file, which the caller may leave out. The owner check
   * matters beyond the tree: deleting a leaf deletes the media under it, so a leaf over another
   * user's media would let its owner delete that media.
   */
  async validateMedia(
    createData: NestStorage.StorageObjectCreate,
  ): Promise<Either<Error, StorageObjectMediaIds>> {
    const { type, userId } = createData;

    if (type === NestStorage.StorageObjectType.FOLDER) {
      return MEDIA_FIELDS.some((field) => createData[field])
        ? left(new BadRequestException('A folder holds no file, image or video'))
        : right({});
    }

    const field = MEDIA_FIELD[type];
    const id = createData[field];

    if (!id) {
      return left(new BadRequestException(`A ${field} object needs the ${field} it places`));
    }

    const media = await this.storageObjectRepository.getMediaToPlace({ type, id, userId });

    if (media.isLeft()) {
      return left(media.value);
    }

    if (!media.value) {
      return left(new NotFoundException(`${_.upperFirst(field)} not found`));
    }

    const { fileId, isPlaced, isBacking, uploadStatus } = media.value;

    const isOtherMediaGiven = MEDIA_FIELDS.some(
      (other) =>
        other !== field && createData[other] && !(other === 'file' && createData.file === fileId),
    );

    if (isOtherMediaGiven) {
      return left(new BadRequestException(`A ${field} object places its ${field} alone`));
    }

    if (isBacking) {
      return left(
        new BadRequestException('This file belongs to an image or a video; place that instead'),
      );
    }

    // Not a 409: that status is a taken name, which the admin shows on the name field.
    if (isPlaced) {
      return left(new BadRequestException(`This ${field} is placed already`));
    }

    // Only what can be served: a pending, failed or still encoding upload may never become a file.
    if (uploadStatus !== NestStorage.FileUploadStatus.READY) {
      return left(new BadRequestException(`This ${field} is not uploaded yet`));
    }

    return right({ file: fileId, [field]: id });
  }

  /**
   * The placement of every leaf one create call puts in a folder: the folder is checked once, and
   * each item takes the same `isPublic` (`resolveIsPublic`: public in a public folder, the caller's
   * choice in a private one) and a name suffixed past the saved siblings and the items before it,
   * so a batch cannot clash with itself.
   */
  async validateLeaves({
    userId,
    parent,
    type,
    names,
    isPublic,
  }: StorageObjectLeavesRequest): Promise<Either<HttpException, StorageObjectPlacementMeta[]>> {
    if (!parent) {
      return left(new BadRequestException('Parent is required'));
    }

    const placement = await this.validatePlacement(parent, userId);

    if (placement.isLeft()) {
      return left(placement.value);
    }

    const reserved = new Set<string>();
    const leaves: StorageObjectPlacementMeta[] = [];
    const leafIsPublic = resolveIsPublic(placement.value.isPublic, isPublic);

    // In order, not in parallel: each name depends on the ones before it.
    for (const requested of names) {
      const name = await this.validateObjectName(
        { userId, parent, type, name: requested },
        reserved,
      );

      if (name.isLeft()) {
        return left(name.value);
      }

      reserved.add(name.value);
      leaves.push({ parent, name: name.value, isPublic: leafIsPublic });
    }

    return right(leaves);
  }

  // A name is taken by any live sibling, a folder's and a file's alike — the rule
  // `storage-objects_name_unique` holds in the database. Deleted objects are hidden and on their
  // way out, so their names are free. Scoped to the owner as well as the folder: a parent is always
  // the owner's own, so this only states the rule — no other user's object can sit in the folder.
  private isNameTaken({
    id,
    userId,
    name,
    parent,
  }: Pick<StorageObjectNameTarget, 'userId' | 'name' | 'parent'> & {
    id?: string;
  }): Promise<boolean> {
    return this.storageObjectRepository.isExists({
      userId,
      parent,
      name,
      isDeleted: false,
      ...(id ? { excludeIds: [id] } : {}),
    });
  }
}
