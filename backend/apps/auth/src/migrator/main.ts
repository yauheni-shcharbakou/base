import { CommandFactory } from 'nest-commander';
import { MigratorModule } from './migrator.module';

const migrator = async () => {
  await CommandFactory.run(MigratorModule, ['log', 'error']);
};

migrator()
  .then()
  .catch(() => {});
