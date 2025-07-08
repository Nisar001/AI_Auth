import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../models/User';
import { OtpService } from '../models/OtpService';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ai_auth_db',
  synchronize: true, // Set to false in production
  logging: false,
  entities: [User, OtpService],
  migrations: [],
  subscribers: [],
});
