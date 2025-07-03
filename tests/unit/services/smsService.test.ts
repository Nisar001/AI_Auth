// Mock dependencies FIRST, before any imports
jest.mock('twilio');
jest.mock('../../../src/utils/logger');

jest.mock('../../../src/utils/ApiError', () => {
  const ApiError = class extends Error {
    statusCode: number;
    data?: any;
    
    constructor(statusCode: number, message: string, data?: any) {
      super(message);
      this.statusCode = statusCode;
      this.name = 'ApiError';
      this.data = data;
    }
  };
  return { ApiError };
});

// Mock environment variables
const originalEnv = process.env;

// Now import everything else
import { SmsService } from '../../../src/services/smsService';
import twilio from 'twilio';
import { ApiError } from '../../../src/utils/ApiError';
import logger from '../../../src/utils/logger';

describe('SmsService', () => {
  // Mock client object
  const mockMessagesCreate = jest.fn();
  const mockTwilioClient = {
    messages: {
      create: mockMessagesCreate
    }
  };
  
  // Spy on console.log for mock mode testing
  const consoleSpy = jest.spyOn(console, 'log');
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables before each test
    process.env = { ...originalEnv };
    process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
    process.env.TWILIO_PHONE_NUMBER = '+18005551234';
    
    // Reset the mocked Twilio constructor
    (twilio as unknown as jest.Mock).mockImplementation(() => mockTwilioClient);
    
    mockMessagesCreate.mockResolvedValue({
      sid: 'message-sid-123'
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize Twilio client with correct credentials', () => {
      // Act
      new SmsService();
      
      // Assert
      expect(twilio).toHaveBeenCalledWith('test-account-sid', 'test-auth-token');
      expect(logger.info).toHaveBeenCalledWith('Twilio SMS service initialized successfully');
    });

    it('should operate in mock mode when Twilio credentials are missing', () => {
      // Arrange
      process.env.TWILIO_ACCOUNT_SID = '';
      process.env.TWILIO_AUTH_TOKEN = '';
      process.env.TWILIO_PHONE_NUMBER = '';
      
      // Act
      const smsService = new SmsService();
      
      // Assert
      expect(twilio).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Twilio configuration missing - SMS service will be in mock mode',
        expect.any(Object)
      );
    });

    it('should handle Twilio initialization errors', () => {
      // Arrange
      (twilio as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('Twilio initialization error');
      });
      
      // Act & Assert
      expect(() => new SmsService()).toThrow(
        new ApiError(500, 'SMS service initialization error')
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize Twilio client:',
        expect.any(Error)
      );
    });
  });

  describe('sendSms', () => {
    it('should send SMS via Twilio client', async () => {
      // Arrange
      const smsService = new SmsService();
      const toNumber = '+12065551234';
      const message = 'Test message';
      
      // Act
      await smsService.sendSms(toNumber, message);
      
      // Assert
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        body: message,
        from: '+18005551234',
        to: toNumber
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        `SMS sent successfully to ${toNumber}: message-sid-123`
      );
    });

    it('should use mock mode when Twilio client is not initialized', async () => {
      // Arrange
      process.env.TWILIO_ACCOUNT_SID = '';
      const smsService = new SmsService();
      const toNumber = '+12065551234';
      const message = 'Test message';
      
      // Act
      await smsService.sendSms(toNumber, message);
      
      // Assert
      expect(mockMessagesCreate).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        `MOCK SMS sent to ${toNumber}: ${message}`
      );
      expect(consoleSpy).toHaveBeenCalledWith(`\n📱 MOCK SMS MESSAGE:`);
    });

    it('should validate phone number format', async () => {
      // Arrange
      const smsService = new SmsService();
      const invalidNumber = '2065551234'; // Missing + prefix
      const message = 'Test message';
      
      // Act & Assert
      await expect(smsService.sendSms(invalidNumber, message)).rejects.toThrow(
        new ApiError(500, 'Failed to send SMS')
      );
    });

    it('should handle Twilio send errors', async () => {
      // Arrange
      const smsService = new SmsService();
      const toNumber = '+12065551234';
      const message = 'Test message';
      
      mockMessagesCreate.mockRejectedValue(new Error('Failed to send'));
      
      // Act & Assert
      await expect(smsService.sendSms(toNumber, message)).rejects.toThrow(
        new ApiError(500, 'Failed to send SMS')
      );
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send SMS:',
        expect.objectContaining({
          error: 'Failed to send',
          to: toNumber
        })
      );
    });

    it('should use fallback mock in development environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const smsService = new SmsService();
      const toNumber = '+12065551234';
      const message = 'Test message';
      
      mockMessagesCreate.mockRejectedValue(new Error('Failed to send'));
      
      // Act
      await smsService.sendSms(toNumber, message);
      
      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        'SMS failed in development mode - continuing with mock'
      );
      expect(consoleSpy).toHaveBeenCalledWith(`\n📱 FALLBACK MOCK SMS MESSAGE:`);
    });
  });

  describe('sendOTPSms', () => {
    it('should send OTP SMS with correct message format', async () => {
      // Arrange
      const smsService = new SmsService();
      const toNumber = '+12065551234';
      const otp = '123456';
      const purpose = 'login';
      
      // Mock the sendSms method
      const sendSmsSpy = jest.spyOn(smsService, 'sendSms').mockResolvedValue();
      
      // Act
      await smsService.sendOTPSms(toNumber, otp, purpose);
      
      // Assert
      expect(sendSmsSpy).toHaveBeenCalledWith(
        toNumber,
        `Your AI Auth OTP for login is: 123456. This code expires in 2 minutes. Never share this code with anyone.`
      );
    });

    it('should use default purpose if not provided', async () => {
      // Arrange
      const smsService = new SmsService();
      const toNumber = '+12065551234';
      const otp = '123456';
      
      // Mock the sendSms method
      const sendSmsSpy = jest.spyOn(smsService, 'sendSms').mockResolvedValue();
      
      // Act
      await smsService.sendOTPSms(toNumber, otp);
      
      // Assert
      expect(sendSmsSpy).toHaveBeenCalledWith(
        toNumber,
        `Your AI Auth OTP for verification is: 123456. This code expires in 2 minutes. Never share this code with anyone.`
      );
    });
  });

  describe('sendWelcomeSms', () => {
    it('should send welcome SMS with correct message format', async () => {
      // Arrange
      const smsService = new SmsService();
      const toNumber = '+12065551234';
      const name = 'John Doe';
      
      // Mock the sendSms method
      const sendSmsSpy = jest.spyOn(smsService, 'sendSms').mockResolvedValue();
      
      // Act
      await smsService.sendWelcomeSms(toNumber, name);
      
      // Assert
      expect(sendSmsSpy).toHaveBeenCalledWith(
        toNumber,
        `Welcome to AI Auth, John Doe! Your account has been created successfully. Please verify your phone number to complete the setup.`
      );
    });
  });

  describe('sendPasswordResetSms', () => {
    it('should send password reset SMS with correct message format', async () => {
      // Arrange
      const smsService = new SmsService();
      const toNumber = '+12065551234';
      const otp = '123456';
      
      // Mock the sendSms method
      const sendSmsSpy = jest.spyOn(smsService, 'sendSms').mockResolvedValue();
      
      // Act
      await smsService.sendPasswordResetSms(toNumber, otp);
      
      // Assert
      expect(sendSmsSpy).toHaveBeenCalledWith(
        toNumber,
        `Your AI Auth password reset OTP is: 123456. This code expires in 2 minutes. If you didn't request this, please contact support immediately.`
      );
    });
  });

  describe('send2FASms', () => {
    it('should send 2FA SMS with correct message format', async () => {
      // Arrange
      const smsService = new SmsService();
      const toNumber = '+12065551234';
      const code = '123456';
      
      // Mock the sendSms method
      const sendSmsSpy = jest.spyOn(smsService, 'sendSms').mockResolvedValue();
      
      // Act
      await smsService.send2FASms(toNumber, code);
      
      // Assert
      expect(sendSmsSpy).toHaveBeenCalledWith(
        toNumber,
        `Your AI Auth 2FA code is: 123456. This code expires in 5 minutes. Never share this code with anyone.`
      );
    });
  });
});
