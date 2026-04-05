import { MigrationTask } from '@backend/persistence';
import { Type } from '@nestjs/common';
import { AddStorageObjectIsFolderTask } from 'migrator/tasks/add-storage-object-is-folder.task';
import { CreateRootFoldersTask } from 'migrator/tasks/create-root-folders.task';

export const migrationTasks: Type<MigrationTask>[] = [
  CreateRootFoldersTask,
  AddStorageObjectIsFolderTask,
];
