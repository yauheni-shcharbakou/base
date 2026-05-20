import { MigrationTask } from '@backend/common';
import { Type } from '@nestjs/common';
import { AddStorageObjectIsFolderTask } from './add-storage-object-is-folder.task';
import { CreateRootFoldersTask } from './create-root-folders.task';

export const migrationTasks: Type<MigrationTask>[] = [
  CreateRootFoldersTask,
  AddStorageObjectIsFolderTask,
];
