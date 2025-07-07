jest.mock('../../src/utils/passwordUtils', () => {
  const originalModule = jest.requireActual('../../src/utils/passwordUtils');
  const comparePasswordMock = jest.fn(async (inputPassword, storedPassword) => {
    console.log('Mock comparePassword called with:', { inputPassword, storedPassword });
    const result = inputPassword === 'Test@1234' && storedPassword === 'hashed-password';
    console.log('Mock comparePassword result:', result);
    return result;
  });

  return {
    ...originalModule,
    comparePassword: comparePasswordMock,
    hashPassword: jest.fn(async (password) => {
      console.log('Mock hashPassword called with:', { password });
      return `hashed-${password}`;
    }),
    validatePasswordStrength: jest.fn(() => {
      console.log('Mock validatePasswordStrength called');
      return {
        isValid: true,
        errors: []
      };
    }),
  };
});

beforeAll(() => {
  console.log('Debug: Ensuring global mock setup for PasswordUtils');
});

beforeEach(() => {
  jest.clearAllMocks();
  console.log('Debug: Cleared all mocks before test execution');
});

// Additional debug logs for test lifecycle
console.log('Debug: Starting test lifecycle');

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
          findOne: jest.fn((query) => {
            if (query.where.id === 1) {
              return {
                id: 1,
                email: 'changepassuser@example.com',
                password: 'hashed-password',
                tokenVersion: 1,
                lastPasswordChange: new Date(),
              };
            } else if (query.where.id === 2) {
              return {
                id: 2,
                email: 'targetuser@example.com',
                tokenVersion: 1,
              };
            }
            return null;
          }),
          update: jest.fn((id, updateData) => {
            if (id === 1 || id === 2) {
              return { affected: 1 };
            }
            return { affected: 0 };
          }),
        };
      }),
    },
  };
});

jest.mock('../../src/middlewares/auth', () => {
  return {
    authenticateToken: jest.fn((req, res, next) => {
      req.user = {
        id: 1,
        email: 'changepassuser@example.com',
        role: 'admin',
        password: 'hashed-password',
        tokenVersion: 1,
        lastPasswordChange: new Date(),
      };
      next();
    }),
    requireEmailVerification: jest.fn((req, res, next) => next()),
    requirePhoneVerification: jest.fn((req, res, next) => next()),
  };
});

// Updated validation for newPassword and confirmPassword fields
jest.mock('../../src/utils/validationUtils', () => {
  return {
    validatePassword: jest.fn((password) => {
      const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      return passwordRegex.test(password);
    }),
  };
});

import request from 'supertest';
import { app } from '../../src/app';
import { AppDataSource } from '../../src/config/db';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

describe('Change Password Integration', () => {
  let accessToken: string;

  beforeEach(() => {
    accessToken = 'mock-access-token';
    jest.clearAllMocks();
  });

  it('should change password successfully', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'Test@1234',
        newPassword: 'NewPass@1234',
        confirmPassword: 'NewPass@1234',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Password changed successfully. Please login again with your new password.',
      data: {
        message: 'Password changed successfully',
        securityNote: 'All existing sessions have been invalidated. Please login again.',
      },
    });
  });

  it('should fail if current password is incorrect', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'WrongPassword',
        newPassword: 'NewPass@1234',
        confirmPassword: 'NewPass@1234',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Current password is incorrect',
    });
  });

  it('should fail if new password is the same as current password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'Test@1234',
        newPassword: 'Test@1234',
        confirmPassword: 'Test@1234',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: 'New password must be different from current password',
    });
  });

  it('should fail if new password does not meet strength requirements', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'Test@1234',
        newPassword: 'weak',
        confirmPassword: 'weak',
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: 'newPassword must be at least 8 characters',
    });
  });
});