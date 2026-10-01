import { NestStorage } from '@backend/proto';
import {
  resolveIsPublic,
  StorageObjectValidationService,
} from '@modules/storage-object/application/services/storage-object.validation.service';
import { StorageObject } from '@modules/storage-object/domain/entities/storage-object.interface';
import {
  StorageObjectCreate,
  StorageObjectRepository,
} from '@modules/storage-object/domain/repositories/storage-object.repository';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Either, left, right } from '@sweet-monads/either';
import _ from 'lodash';

const SEPARATOR = '/';

const getParentPath = (path: string) => path.split(SEPARATOR).slice(0, -1).join(SEPARATOR);

/**
 * A folder tree made under one of the owner's folders at once — an uploaded directory. One
 * transaction under the owner's tree lock, so all or none.
 *
 * A top-level folder whose name is taken in `parent` gets a ` (n)` suffix, as a moved one does:
 * nobody typed the name, so there is nothing to refuse. The folders below it are new, and cannot
 * clash. Each is private unless `parent` is public (`resolveIsPublic`). Returns the folders in
 * `paths` order.
 */
@Injectable()
export class StorageObjectCreateFoldersUseCase {
  constructor(
    private readonly storageObjectRepository: StorageObjectRepository,
    private readonly validationService: StorageObjectValidationService,
  ) {}

  async execute({
    userId,
    parent,
    paths,
  }: NestStorage.StorageObjectCreateFolders): Promise<Either<Error, StorageObject[]>> {
    const invalid = this.validatePaths(paths ?? []);

    if (invalid) {
      return left(new BadRequestException(invalid));
    }

    // Parents before their children: each level is saved once the one above it has ids.
    const byDepth = _.groupBy(paths, (path) => path.split(SEPARATOR).length);
    const levels = _.sortBy(Object.keys(byDepth).map(Number)).map((depth) => byDepth[depth]);

    return this.storageObjectRepository.withTreeLock(userId, async () => {
      const placement = await this.validationService.validatePlacement(parent, userId);

      if (placement.isLeft()) {
        return left(placement.value);
      }

      const isPublic = resolveIsPublic(placement.value.isPublic);
      const created = new Map<string, StorageObject>();
      const reserved = new Set<string>();

      for (const level of levels) {
        const rows: StorageObjectCreate[] = [];

        for (const path of level) {
          const parentPath = getParentPath(path);
          const name = _.last(path.split(SEPARATOR));

          rows.push({
            userId,
            type: NestStorage.StorageObjectType.FOLDER,
            isFolder: true,
            isPublic,
            parent: parentPath ? created.get(parentPath).id : parent,
            name: parentPath ? name : await this.resolveTopName(userId, parent, name, reserved),
          });
        }

        const saved = await this.storageObjectRepository.saveMany(rows);

        if (saved.isLeft()) {
          return left(saved.value);
        }

        level.forEach((path, index) => created.set(path, saved.value[index]));
      }

      return right(paths.map((path) => created.get(path)));
    });
  }

  private async resolveTopName(
    userId: string,
    parent: string,
    name: string,
    reserved: Set<string>,
  ): Promise<string> {
    const free = await this.validationService.resolveFreeName(
      { userId, parent, name, isFolder: true },
      reserved,
    );

    reserved.add(free);
    return free;
  }

  // The tree has to be whole: no empty segment, no path twice, every nested path's parent listed.
  private validatePaths(paths: string[]): string | undefined {
    if (!paths.length) {
      return 'No folders to create';
    }

    const listed = new Set(paths);

    if (listed.size !== paths.length) {
      return 'A folder path is listed twice';
    }

    for (const path of paths) {
      if (path.split(SEPARATOR).some((segment) => !segment)) {
        return `Invalid folder path "${path}"`;
      }

      const parentPath = getParentPath(path);

      if (parentPath && !listed.has(parentPath)) {
        return `Folder path "${path}" has no parent "${parentPath}" in the list`;
      }
    }
  }
}
