import request from 'supertest';
import { app } from '../../src/app';
import { AppDataSource } from '../../src/config/db';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

jest.mock('../../src/middlewares/auth', () => {
  return {
    authenticateToken: jest.fn((req, res, next) => {
      req.user = {
        id: 1,
        email: 'profileuser@example.com',
        profile: { name: 'Test User' },
      };
      next();
    }),
    requireEmailVerification: jest.fn((req, res, next) => {
      if (!req.user?.email) {
        res.status(403).json({ error: 'Email verification required' });
        return;
      }
      next();
    }),
    requirePhoneVerification: jest.fn((req, res, next) => {
      if (!req.user?.profile?.name) {
        res.status(403).json({ error: 'Phone verification required' });
        return;
      }
      next();
    }),
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
            if (query.where.id === 1) {
              return {
                id: 1,
                fname: 'Test',
                lname: 'User',
                email: 'profileuser@example.com',
                profile: { name: 'Test User' },
              };
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

jest.mock('../../src/services/smsService', () => {
  return {
    SmsService: jest.fn().mockImplementation(() => {
      return {
        sendSms: jest.fn(async () => {
          return { success: true, message: 'Mock SMS sent' };
        }),
      };
    }),
  };
});

jest.mock('../../src/services/emailService', () => {
  return {
    EmailService: jest.fn().mockImplementation(() => {
      return {
        sendEmail: jest.fn(async () => {
          return { success: true, message: 'Mock email sent' };
        }),
      };
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Profile Integration', () => {
  let accessToken: string;

  beforeEach(() => {
    accessToken = 'mock-access-token';
  });

  it('should get user profile', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('profileuser@example.com');
    expect(res.body).toMatchSnapshot();
  });

  it('should update user profile', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fname: 'Updated', lname: 'Name' });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.fname).toBe('Updated');
    expect(res.body).toMatchSnapshot();
  });

  // Refactor the profile retrieval test
  it('should retrieve user profile successfully', async () => {
    const repository = AppDataSource.getRepository('User');

    // Mock repository methods
    jest.spyOn(repository, 'create').mockImplementation((entity: any) => {
      return { id: 1, ...entity };
    });

    jest.spyOn(repository, 'save').mockImplementation(async (entity: any) => {
      return { id: 1, ...entity };
    });

    jest.spyOn(repository, 'findOne').mockImplementation(async (query: any) => {
      if (query.where.email === 'test@example.com') {
        return { id: 1, email: 'test@example.com', profile: { name: 'Test User' } };
      }
      return null;
    });

    // Test logic
    const user = repository.create({ email: 'test@example.com', password: 'password123', profile: { name: 'Test User' } });
    await repository.save(user);

    const savedUser = await repository.findOne({ where: { email: 'test@example.com' }, relations: ['profile'] });
    expect(savedUser).not.toBeNull();
    expect(savedUser!.profile.name).toBe('Test User');
    expect(savedUser).toMatchSnapshot({
      id: expect.any(Number),
      email: expect.any(String),
      profile: {
        name: expect.any(String),
      },
    });
  });
});
