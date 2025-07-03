// Mock dependencies FIRST, before any imports
jest.mock('crypto');

// Now import everything else
import { OtpGenerator } from '../../../src/utils/otpGenerator';
import crypto from 'crypto';

describe('OtpGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('generateNumericOtp', () => {
    it('should generate numeric OTP with default length of 6', () => {
      // Mock Math.random to return predictable values
      const mockMath = Object.create(global.Math);
      mockMath.random = () => 0.5;
      global.Math = mockMath;

      // Act
      const result = OtpGenerator.generateNumericOtp();

      // Assert
      expect(result).toHaveLength(6);
      expect(result).toEqual(expect.stringMatching(/^\d{6}$/));
      
      // Restore Math
      global.Math = Object.create(Math);
    });

    it('should generate numeric OTP with custom length', () => {
      // Mock Math.random to return predictable values
      const mockMath = Object.create(global.Math);
      mockMath.random = () => 0.5;
      global.Math = mockMath;

      // Act
      const result = OtpGenerator.generateNumericOtp(4);

      // Assert
      expect(result).toHaveLength(4);
      expect(result).toEqual(expect.stringMatching(/^\d{4}$/));
      
      // Restore Math
      global.Math = Object.create(Math);
    });
  });

  describe('generateAlphaNumericOtp', () => {
    it('should generate alphanumeric OTP with default length of 6', () => {
      // Mock Math.random to return predictable values
      const mockMath = Object.create(global.Math);
      mockMath.random = () => 0.5;
      global.Math = mockMath;

      // Act
      const result = OtpGenerator.generateAlphaNumericOtp();

      // Assert
      expect(result).toHaveLength(6);
      expect(result).toEqual(expect.stringMatching(/^[A-Z0-9]{6}$/));
      
      // Restore Math
      global.Math = Object.create(Math);
    });

    it('should generate alphanumeric OTP with custom length', () => {
      // Mock Math.random to return predictable values
      const mockMath = Object.create(global.Math);
      mockMath.random = () => 0.5;
      global.Math = mockMath;

      // Act
      const result = OtpGenerator.generateAlphaNumericOtp(8);

      // Assert
      expect(result).toHaveLength(8);
      expect(result).toEqual(expect.stringMatching(/^[A-Z0-9]{8}$/));
      
      // Restore Math
      global.Math = Object.create(Math);
    });
  });

  describe('generateSecureOtp', () => {
    it('should generate secure OTP with default length of 6', () => {
      // Mock crypto.randomInt to return predictable values
      (crypto.randomInt as jest.Mock).mockImplementation((min, max) => 5);

      // Act
      const result = OtpGenerator.generateSecureOtp();

      // Assert
      expect(result).toHaveLength(6);
      expect(result).toBe('555555');
      expect(crypto.randomInt).toHaveBeenCalledTimes(6);
    });

    it('should generate secure OTP with custom length', () => {
      // Mock crypto.randomInt to return predictable values
      (crypto.randomInt as jest.Mock).mockImplementation((min, max) => 5);

      // Act
      const result = OtpGenerator.generateSecureOtp(4);

      // Assert
      expect(result).toHaveLength(4);
      expect(result).toBe('5555');
      expect(crypto.randomInt).toHaveBeenCalledTimes(4);
    });

    it('should generate different digits based on randomInt values', () => {
      // Mock crypto.randomInt to return different values
      (crypto.randomInt as jest.Mock)
        .mockReturnValueOnce(0) // 0
        .mockReturnValueOnce(1) // 1
        .mockReturnValueOnce(2) // 2
        .mockReturnValueOnce(3) // 3
        .mockReturnValueOnce(4) // 4
        .mockReturnValueOnce(5); // 5

      // Act
      const result = OtpGenerator.generateSecureOtp();

      // Assert
      expect(result).toHaveLength(6);
      expect(result).toBe('012345');
      expect(crypto.randomInt).toHaveBeenCalledTimes(6);
    });
  });

  describe('getOtpExpiry', () => {
    it('should return date 10 minutes in the future by default', () => {
      // Current time is 2025-01-01 (set in beforeEach)
      const expectedTime = new Date('2025-01-01T00:10:00.000Z');
      
      // Act
      const result = OtpGenerator.getOtpExpiry();

      // Assert
      expect(result).toEqual(expectedTime);
    });

    it('should return date with custom minutes in the future', () => {
      // Current time is 2025-01-01 (set in beforeEach)
      const expectedTime = new Date('2025-01-01T00:30:00.000Z');
      
      // Act
      const result = OtpGenerator.getOtpExpiry(30);

      // Assert
      expect(result).toEqual(expectedTime);
    });
  });

  describe('isOtpExpired', () => {
    it('should return true if OTP is expired', () => {
      // Current time is 2025-01-01 (set in beforeEach)
      const pastDate = new Date('2024-12-31');
      
      // Act
      const result = OtpGenerator.isOtpExpired(pastDate);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if OTP is not expired', () => {
      // Current time is 2025-01-01 (set in beforeEach)
      const futureDate = new Date('2025-01-02');
      
      // Act
      const result = OtpGenerator.isOtpExpired(futureDate);

      // Assert
      expect(result).toBe(false);
    });
  });
});
