import { MigrationTask } from '@backend/persistence';
import { Type } from '@nestjs/common';
import { CreateRootFoldersTask } from 'migrator/tasks/create-root-folders.task';

export const migrationTasks: Type<MigrationTask>[] = [CreateRootFoldersTask];
