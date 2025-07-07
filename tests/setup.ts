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

  // Reapply middleware mock to ensure persistence
  jest.mock('../src/middlewares/auth', () => {
    return {
      authenticateToken: jest.fn((req, res, next) => {
        console.log(`Debug: Mock authenticateToken middleware executed for ${req.path} with headers:`, req.headers);
        if (req.path === '/api/auth/profile' || req.path === '/api/auth/protected-route') {
          req.user = {
            id: 1,
            email: 'middlewareuser@example.com',
          };
          console.log('Debug: req.user set to:', req.user);
          next();
          return;
        }
        console.log('Debug: req.user not set, returning 401');
        res.status(401).json({ message: 'Authentication required' });
      }),
      requireEmailVerification: jest.fn((req, res, next) => {
        console.log(`Debug: Mock requireEmailVerification middleware executed for ${req.path}`);
        next();
      }),
      requirePhoneVerification: jest.fn((req, res, next) => {
        console.log(`Debug: Mock requirePhoneVerification middleware executed for ${req.path}`);
        next();
      }),
    };
  });
});

// Global console mocks
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Temporarily disable global console.log mock for debugging
// global.console.log = originalConsole.log;

// Mock Date.now for consistent testing
const mockDate = new Date('2025-07-02T10:00:00.000Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
(Date.now as jest.Mock) = jest.fn(() => mockDate.getTime());
