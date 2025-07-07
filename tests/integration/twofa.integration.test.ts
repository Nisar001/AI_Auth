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

jest.mock('../../src/utils/jwtUtils', () => {
  return {
    JwtUtils: {
      getTokenFromHeader: jest.fn(() => 'mock-access-token'),
      verifyAccessToken: jest.fn(() => ({
        userId: 'test-user-id',
        email: 'test@example.com',
      })),
    },
  };
});

jest.mock('../../src/middlewares/auth', () => {
  return {
    authenticateToken: jest.fn((req, res, next) => {
      req.user = {
        id: 'test-user-id',
        email: 'test@example.com',
        isEmailVerified: true,
        isPhoneVerified: true,
      };
      next();
    }),
    requireEmailVerification: jest.fn((req, res, next) => {
      if (!req.user?.isEmailVerified) {
        res.status(403).json({ error: 'Email verification required' });
        return;
      }
      next();
    }),
    requirePhoneVerification: jest.fn((req, res, next) => {
      if (!req.user?.isPhoneVerified) {
        res.status(403).json({ error: 'Phone verification required' });
        return;
      }
      next();
    }),
  };
});

jest.mock('../../src/middlewares/validation', () => {
  return {
    validateRequest: jest.fn((schema) => (req: any, res: any, next: any) => {
      next();
    }),
  };
});

jest.mock('../../src/utils/passwordUtils', () => {
  return {
    PasswordUtils: {
      comparePassword: jest.fn((providedPassword, storedPassword) => {
        return providedPassword === 'valid-password' && storedPassword === 'hashed-password';
      }),
    },
  };
});

jest.mock('../../src/services/otpService', () => {
  return {
    OtpService: jest.fn().mockImplementation(() => {
      return {
        generateAndSendOtp: jest.fn(async (user, method, context) => {
          return { otpId: 'mock-otp-id' };
        }),
        cleanupExpiredOtps: jest.fn(async () => {
          return true;
        }),
        generateSecretFor2FA: jest.fn(async (userId) => {
          return { secret: 'mock-secret', qrCode: 'mock-qr-code' };
        }),
      };
    }),
  };
});

import request from 'supertest';
import { app } from '../../src/app';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

jest.mock('../../src/config/db', () => {
  return {
    AppDataSource: {
      getRepository: jest.fn(() => {
        return {
          findOne: jest.fn(async (query: any) => {
            if (query.where.id === 'test-user-id') {
              return {
                id: 'test-user-id',
                email: 'test@example.com',
                isEmailVerified: true,
                isPhoneVerified: true,
                password: 'hashed-password',
              };
            }
            return null;
          }),
          save: jest.fn(async (entity: any) => {
            return { id: 'test-user-id', ...entity };
          }),
        };
      }),
    },
  };
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

describe('2FA Integration', () => {
  let accessToken: string;

  beforeEach(() => {
    accessToken = 'mock-access-token';
  });

  // Refactor the 2FA setup test
  it('should initiate 2FA setup', async () => {
    const res = await request(app)
      .post('/api/auth/setup-2fa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ method: 'email', password: 'valid-password' });

    expect(res.status).toBe(200); // Ensure successful initiation
    expect(res.body).toMatchSnapshot({
      data: {
        instructions: expect.any(Array),
        method: 'email',
        status: 'setup_initiated',
      },
      message: expect.any(String),
      statusCode: expect.any(Number),
      success: expect.any(Boolean),
    });
  });
});
