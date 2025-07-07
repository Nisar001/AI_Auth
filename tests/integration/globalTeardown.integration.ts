import { TestDataSource } from './db.integration';

export default async (): Promise<void> => {
  // Clean the database after tests
  const entities = TestDataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = TestDataSource.getRepository(entity.name);
    await repository.query(`TRUNCATE TABLE ${entity.tableName} RESTART IDENTITY CASCADE;`);
  }

  // Close the test database connection
  if (TestDataSource.isInitialized) {
    await TestDataSource.destroy();
  }
};