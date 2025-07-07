import dotenv from 'dotenv';
dotenv.config({ path: 'e:\\Solulab\\AI_Auth\\.env.test' });
import { TestDataSource } from './db.integration';

console.log('Loaded Environment Variables:', {
  NODE_ENV: process.env.NODE_ENV,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS,
  DB_NAME: process.env.DB_NAME,
});

export default async (): Promise<void> => {
  // Initialize the test database connection
  if (!TestDataSource.isInitialized) {
    await TestDataSource.initialize();
  }

  // Clean the database before tests
  const entities = TestDataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = TestDataSource.getRepository(entity.name);
    await repository.query(`TRUNCATE TABLE ${entity.tableName} RESTART IDENTITY CASCADE;`);
  }
};