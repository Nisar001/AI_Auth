// Global test setup
import 'reflect-metadata';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRY = '24h';
process.env.REFRESH_TOKEN_EXPIRY = '7d';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'test';
process.env.DB_PASS = 'test';
process.env.DB_NAME = 'test_db';
process.env.EMAIL_HOST = 'smtp.gmail.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASS = 'test-password';
process.env.EMAIL_FROM = 'test@example.com';
process.env.TWILIO_ACCOUNT_SID = 'test-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-token';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';

// Setup runs after Jest is initialized, so jest globals are available
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Global console mocks
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock Date.now for consistent testing
const mockDate = new Date('2025-07-02T10:00:00.000Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
(Date.now as jest.Mock) = jest.fn(() => mockDate.getTime());
