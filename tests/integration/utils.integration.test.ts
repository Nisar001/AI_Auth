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

import request from 'supertest';
import { app } from '../../src/app';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Ensure proper isolation for utility tests
jest.mock('../../src/config/db', () => {
  return {
    AppDataSource: {
      getRepository: jest.fn(() => {
        return {
          findOne: jest.fn(),
          save: jest.fn(),
          query: jest.fn(),
        };
      }),
      initialize: jest.fn().mockResolvedValue(undefined),
      synchronize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Utils Integration (JWT, API Health)', () => {
  it('should return health status', async () => {
    const res = await request(app)
      .get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body).toMatchSnapshot({
      uptime: expect.any(Number),
    });
  });

  // Add more utility endpoint tests as needed
});
