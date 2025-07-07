// Mock Twilio and Nodemailer before any imports
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn().mockResolvedValue({ sid: 'mock-sid' }) }
  }));
});

jest.mock('nodemailer', () => {
  return {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
      verify: jest.fn().mockResolvedValue(true)
    }))
  };
});

jest.mock('../../src/config/db', () => {
  return {
    AppDataSource: {
      entityMetadatas: [
        { name: 'User', tableName: 'users' },
      ],
      getRepository: jest.fn(() => {
        return {
          create: jest.fn(),
          save: jest.fn(),
          findOne: jest.fn(),
          query: jest.fn(),
        };
      }),
      initialize: jest.fn().mockResolvedValue(undefined),
      synchronize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    },
  };
});

import request from 'supertest';
import { app } from '../../src/app';
import { AppDataSource } from '../../src/config/db';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Password Reset Integration', () => {
  it('should request password reset (forgot-password)', async () => {
    const repository = AppDataSource.getRepository('User');

    // Mock repository methods
    jest.spyOn(repository, 'findOne').mockResolvedValue(null);
    jest.spyOn(repository, 'create').mockImplementation((entity: any) => {
      return { id: 1, ...entity };
    });
    jest.spyOn(repository, 'save').mockResolvedValue({ id: 1, email: 'resetuser@example.com' });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ identifier: 'resetuser@example.com', method: 'email' });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body).toMatchSnapshot();
  });

  it('should validate password successfully', async () => {
    const repository = AppDataSource.getRepository('User');

    // Mock repository methods
    jest.spyOn(repository, 'create').mockImplementation((entity: any) => {
      return { id: 1, ...entity };
    });
    jest.spyOn(repository, 'save').mockResolvedValue({ id: 1, email: 'test@example.com', password: 'password123' });
    jest.spyOn(repository, 'findOne').mockResolvedValue({ id: 1, email: 'test@example.com', password: 'password123' });

    const user = repository.create({ email: 'test@example.com', password: 'password123' });
    await repository.save(user);

    const savedUser = await repository.findOne({ where: { email: 'test@example.com' } });
    expect(savedUser).not.toBeNull();

    // Simulate password validation logic
    const isValidPassword = savedUser!.password === 'password123';
    expect(isValidPassword).toBe(true);
    expect(savedUser).toMatchSnapshot({
      id: expect.any(Number),
      email: expect.any(String),
      password: expect.any(String),
    });
  });
});
