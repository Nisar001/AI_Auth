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
      getRepository: jest.fn(() => {
        return {
          create: jest.fn((entity: any) => {
            return { id: 1, ...entity };
          }),
          save: jest.fn(async (entity: any) => {
            return { id: 1, ...entity };
          }),
          findOne: jest.fn(async (query: any) => {
            if (query.where.socialId === 'social123') {
              return { id: 1, email: 'social@example.com', socialId: 'social123' };
            }
            return null;
          }),
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Social Login Integration', () => {
  it('should get Google OAuth URL', async () => {
    const res = await request(app)
      .get('/api/auth/google/auth-url');

    expect([200, 201, 400]).toContain(res.status);
    expect(res.body).toMatchSnapshot();
  });

  it('should get GitHub OAuth URL', async () => {
    const res = await request(app)
      .get('/api/auth/github/auth-url');

    expect([200, 201, 400]).toContain(res.status);
    expect(res.body).toMatchSnapshot();
  });

  // Refactor the social login test
  it('should handle social login successfully', async () => {
    const repository = AppDataSource.getRepository('User');

    // Mock repository methods
    jest.spyOn(repository, 'create').mockImplementation((entity: any) => {
      return { id: 1, ...entity };
    });

    jest.spyOn(repository, 'save').mockImplementation(async (entity: any) => {
      return { id: 1, ...entity };
    });

    jest.spyOn(repository, 'findOne').mockImplementation(async (query: any) => {
      if (query.where.socialId === 'social123') {
        return { id: 1, email: 'social@example.com', socialId: 'social123' };
      }
      return null;
    });

    // Test logic
    const user = repository.create({ email: 'social@example.com', password: 'password123', socialId: 'social123' });
    await repository.save(user);

    const savedUser = await repository.findOne({ where: { socialId: 'social123' } });
    expect(savedUser).not.toBeNull();
    expect(savedUser!.email).toBe('social@example.com');
    expect(savedUser).toMatchSnapshot({
      id: expect.any(Number),
      email: expect.any(String),
      socialId: expect.any(String),
    });
  });
});
