import { MigrationTask } from '@backend/persistence';
import { Type } from '@nestjs/common';
import { CreateAdmin } from 'common/migrations/create-admin';

export const migrationTasks: Type<MigrationTask>[] = [CreateAdmin];
