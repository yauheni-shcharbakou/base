import { MigratorModule } from 'migrator/migrator.module';
import { CommandFactory } from 'nest-commander';

const migrator = async () => {
  await CommandFactory.run(MigratorModule, ['log', 'error']);
};

migrator();
