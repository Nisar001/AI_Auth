// Mock dependencies FIRST
jest.mock('nodemailer');

// Now import everything else
import { EmailService, EmailOptions } from '../../../src/services/emailService';
import nodemailer from 'nodemailer';
import { ApiError } from '../../../src/utils/ApiError';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    // Setup mock transporter
    mockTransporter = {
      verify: jest.fn(),
      sendMail: jest.fn()
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    // Setup environment variables
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASS = 'testpass';
    process.env.EMAIL_FROM = 'noreply@example.com';

    emailService = new EmailService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create transporter with correct configuration', () => {
      // Assert
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'testpass'
        }
      });
    });

    it('should verify connection on initialization', () => {
      // Assert
      expect(mockTransporter.verify).toHaveBeenCalled();
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      // Arrange
      const emailOptions: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content'
      };
      
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      // Act
      await emailService.sendEmail(emailOptions);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content'
      });
    });

    it('should send email without text content', async () => {
      // Arrange
      const emailOptions: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>'
      };
      
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await emailService.sendEmail(emailOptions);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: undefined
      });
    });

    it('should throw ApiError when email sending fails', async () => {
      // Arrange
      const emailOptions: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>'
      };
      
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Error'));

      // Act & Assert
      await expect(emailService.sendEmail(emailOptions)).rejects.toThrow(ApiError);
      await expect(emailService.sendEmail(emailOptions)).rejects.toThrow('Failed to send email');
    });
  });

  describe('sendOTPEmail', () => {
    it('should send OTP email with default purpose', async () => {
      // Arrange
      const email = 'user@example.com';
      const otp = '123456';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await emailService.sendOTPEmail(email, otp);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Your OTP for verification',
        html: expect.stringContaining('123456'),
        text: expect.stringContaining('123456')
      });
    });

    it('should send OTP email with custom purpose', async () => {
      // Arrange
      const email = 'user@example.com';
      const otp = '654321';
      const purpose = 'password reset';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await emailService.sendOTPEmail(email, otp, purpose);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Your OTP for password reset',
        html: expect.stringContaining('654321'),
        text: expect.stringContaining('654321')
      });
    });

    it('should include security warnings in OTP email', async () => {
      // Arrange
      const email = 'user@example.com';
      const otp = '123456';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await emailService.sendOTPEmail(email, otp);

      // Assert
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Never share this OTP with anyone');
      expect(callArgs.html).toContain('This OTP is valid for 2 minutes only');
      expect(callArgs.text).toContain('Never share this OTP with anyone');
    });

    it('should format HTML email correctly', async () => {
      // Arrange
      const email = 'user@example.com';
      const otp = '123456';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await emailService.sendOTPEmail(email, otp);

      // Assert
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('AI Auth');
      expect(callArgs.html).toContain('<div class="otp-code">123456</div>');
      expect(callArgs.html).toContain('Secure Authentication Service');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      // Arrange
      const email = 'newuser@example.com';
      const firstName = 'John';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await emailService.sendWelcomeEmail(email, firstName);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'newuser@example.com',
        subject: 'Welcome to AI Auth!',
        html: expect.stringContaining('John'),
        text: expect.stringContaining('John')
      });
    });

    it('should include welcome message content', async () => {
      // Arrange
      const email = 'newuser@example.com';
      const firstName = 'Jane';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await emailService.sendWelcomeEmail(email, firstName);

      // Assert
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Welcome to AI Auth');
      expect(callArgs.html).toContain('Jane');
      expect(callArgs.text).toContain('Welcome to AI Auth');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with OTP', async () => {
      // Arrange
      const email = 'user@example.com';
      const otp = '123456';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await emailService.sendPasswordResetEmail(email, otp);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Reset Your Password',
        html: expect.stringContaining('123456'),
        text: expect.stringContaining('123456')
      });
    });

    it('should include security information in password reset email', async () => {
      // Arrange
      const email = 'user@example.com';
      const otp = '654321';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });

      // Act
      await emailService.sendPasswordResetEmail(email, otp);

      // Assert
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('valid for 2 minutes only');
      expect(callArgs.html).toContain('If you didn\'t request this password reset');
      expect(callArgs.text).toContain('valid for 2 minutes only');
    });
  });

  describe('error handling', () => {
    it('should handle transporter verification failure gracefully', () => {
      // Arrange
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      // Act & Assert - Should not throw during construction
      expect(() => new EmailService()).not.toThrow();
    });

    it('should handle missing environment variables', () => {
      // Arrange
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_USER;

      // Act & Assert - Should still create service
      expect(() => new EmailService()).not.toThrow();
    });

    it('should throw ApiError for all email sending failures', async () => {
      // Arrange
      const emailOptions: EmailOptions = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      };
      
      const errorCases = [
        new Error('Network error'),
        new Error('Authentication failed'),
        new Error('Recipient rejected'),
        new Error('Rate limit exceeded')
      ];

      for (const error of errorCases) {
        mockTransporter.sendMail.mockRejectedValueOnce(error);
        
        // Act & Assert
        await expect(emailService.sendEmail(emailOptions)).rejects.toThrow(ApiError);
        await expect(emailService.sendEmail(emailOptions)).rejects.toThrow('Failed to send email');
      }
    });
  });
});
