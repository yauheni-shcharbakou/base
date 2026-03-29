import { MigrationTask } from '@backend/persistence';
import { Type } from '@nestjs/common';
import { CreateAdminTask } from 'migrator/tasks/create-admin.task';

export const migrationTasks: Type<MigrationTask>[] = [CreateAdminTask];
