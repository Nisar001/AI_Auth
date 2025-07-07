import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../../src/models/User';
import { OtpService } from '../../src/models/OtpService';

export const TestDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  username: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASS || '',
  database: process.env.TEST_DB_NAME || 'ai_auth_test_db',
  synchronize: true, // Enable synchronize for testing
  logging: false,
  entities: [User, OtpService],
  migrations: [],
  subscribers: [],
});
