import { defineConfig } from '@mikro-orm/postgresql';

export default defineConfig({
  entities: ['./src/entities'],
  entitiesTs: ['./src/entities'],
  migrations: {
    path: './migrations',
    pathTs: './migrations',
    tableName: 'mikro_orm_migrations',
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
  },
  driverOptions: {},
  debug: false,
  allowGlobalContext: true,
  extensions: [],
  discovery: { disableDynamicFileAccess: true },
  schemaGenerator: { disableForeignKeys: false },
  forceUndefined: true,
  pool: { min: 1, max: 10 },
  // Read DB_URL from process.env at runtime by MikroORM
});

