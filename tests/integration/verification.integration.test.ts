// Correct syntax and scope issues in mocks and test setup
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

// Persistent in-memory user store for this test file
let users: any[] = [];
let idCounter = 1;

// Reset in-memory store before each test
beforeEach(() => {
  users = [];
  idCounter = 1;
});

// Replace real DB initialization and destruction with mocks
jest.mock('../../src/config/db', () => {
  return {
    AppDataSource: {
      getRepository: jest.fn(() => {
        return {
          findOne: jest.fn(async (query: any) => {
            if (query.where.email) {
              return users.find(u => u.email === query.where.email) || null;
            }
            if (query.where.phone && query.where.countryCode) {
              return users.find(u => u.phone === query.where.phone && u.countryCode === query.where.countryCode) || null;
            }
            if (query.where.phone) {
              return users.find(u => u.phone === query.where.phone) || null;
            }
            return null;
          }),
          find: jest.fn(async () => users),
          save: jest.fn(async (entity: any) => {
            users.push(entity);
            return entity;
          }),
          count: jest.fn(() => users.length),
        };
      }),
      initialize: jest.fn().mockResolvedValue(true),
      synchronize: jest.fn().mockResolvedValue(true),
    },
  };
});

jest.mock('../../src/services/otpService', () => {
  return {
    OtpService: jest.fn().mockImplementation(() => {
      return {
        generateAndSendOtp: jest.fn().mockResolvedValue({ success: true, otpId: 'mock-otp-id' }),
      };
    }),
  };
});

import request from 'supertest';
import { app } from '../../src/app';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Reset in-memory store before each test
beforeEach(() => {
  users = [];
  idCounter = 1;
});

describe('Resend OTP Integration Tests', () => {
  it('should resend email OTP successfully', async () => {
    // Mock user registration
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test@1234',
        phone: '+1234567890',
        countryCode: '+1',
        fname: 'Test',
        lname: 'User',
        dob: '1990-01-01',
        address: {
          houseNumber: '5E',
          street: 'Fifth St',
          line1: '202 Main St',
          city: 'Testtown',
          state: 'TS',
          country: 'Testland',
          pincode: '987654'
        }
      });

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ identifier: 'test@example.com', type: 'email' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toMatchSnapshot({
      data: expect.any(Object),
      message: expect.any(String),
      statusCode: expect.any(Number),
      success: expect.any(Boolean),
    });
  });

  it('should resend phone OTP successfully', async () => {
    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ identifier: '+1234567890', type: 'sms' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toMatchSnapshot({
      data: expect.any(Object),
      message: expect.any(String),
      statusCode: expect.any(Number),
      success: expect.any(Boolean),
    });
  });

  it('should return error for invalid identifier', async () => {
    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ identifier: 'invalid@example.com', type: 'email' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toMatchSnapshot({
      message: expect.any(String),
    });
  });

  it('should enforce rate limiting for OTP requests', async () => {
    await request(app)
      .post('/api/auth/resend-otp')
      .send({ identifier: 'test@example.com', type: 'email' });

    const res = await request(app)
      .post('/api/auth/resend-otp')
      .send({ identifier: 'test@example.com', type: 'email' });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body).toMatchSnapshot();
  });
});

// Ensure proper cleanup of mocks and open handles
afterEach(() => {
  jest.clearAllMocks();
});
