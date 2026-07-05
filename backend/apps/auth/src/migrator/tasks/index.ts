import { MigrationTask } from '@backend/common';
import { Type } from '@nestjs/common';
import { CreateAdminTask } from './create-admin.task';

export const migrationTasks: Type<MigrationTask>[] = [CreateAdminTask];
