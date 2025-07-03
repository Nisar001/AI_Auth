// Mock dependencies FIRST
jest.mock('bcryptjs');

// Now import everything else
import { PasswordUtils } from '../../../src/utils/passwordUtils';
import bcrypt from 'bcryptjs';

describe('PasswordUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      // Arrange
      const password = 'testPassword123!';
      const mockSalt = 'mockSalt';
      const mockHash = 'mockHashedPassword';

      (bcrypt.genSalt as jest.Mock).mockResolvedValue(mockSalt);
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHash);

      // Act
      const result = await PasswordUtils.hashPassword(password);

      // Assert
      expect(bcrypt.genSalt).toHaveBeenCalledWith(12);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, mockSalt);
      expect(result).toBe(mockHash);
    });

    it('should throw error when hashing fails', async () => {
      // Arrange
      const password = 'testPassword123!';
      (bcrypt.genSalt as jest.Mock).mockRejectedValue(new Error('Hashing failed'));

      // Act & Assert
      await expect(PasswordUtils.hashPassword(password)).rejects.toThrow('Failed to hash password');
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      // Arrange
      const password = 'testPassword123!';
      const hashedPassword = 'hashedPassword';
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await PasswordUtils.comparePassword(password, hashedPassword);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it('should return false for non-matching passwords', async () => {
      // Arrange
      const password = 'testPassword123!';
      const hashedPassword = 'hashedPassword';
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await PasswordUtils.comparePassword(password, hashedPassword);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(false);
    });

    it('should throw error when comparison fails', async () => {
      // Arrange
      const password = 'testPassword123!';
      const hashedPassword = 'hashedPassword';
      (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('Comparison failed'));

      // Act & Assert
      await expect(PasswordUtils.comparePassword(password, hashedPassword)).rejects.toThrow('Failed to compare password');
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password as valid', () => {
      // Arrange
      const strongPassword = 'StrongPassword123!';

      // Act
      const result = PasswordUtils.validatePasswordStrength(strongPassword);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password that is too short', () => {
      // Arrange
      const shortPassword = 'Short1!';

      // Act
      const result = PasswordUtils.validatePasswordStrength(shortPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      // Arrange
      const noUpperPassword = 'lowercase123!';

      // Act
      const result = PasswordUtils.validatePasswordStrength(noUpperPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      // Arrange
      const noLowerPassword = 'UPPERCASE123!';

      // Act
      const result = PasswordUtils.validatePasswordStrength(noLowerPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without numbers', () => {
      // Arrange
      const noNumberPassword = 'NoNumbers!';

      // Act
      const result = PasswordUtils.validatePasswordStrength(noNumberPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special characters', () => {
      // Arrange
      const noSpecialPassword = 'NoSpecial123';

      // Act
      const result = PasswordUtils.validatePasswordStrength(noSpecialPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject password with multiple issues', () => {
      // Arrange
      const weakPassword = 'weak';

      // Act
      const result = PasswordUtils.validatePasswordStrength(weakPassword);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should accept password with all required elements', () => {
      // Test various valid passwords
      const validPasswords = [
        'ValidPass123!',
        'AnotherGood1@',
        'Complex#Password9',
        'MySecure$Pass8'
      ];

      validPasswords.forEach(password => {
        const result = PasswordUtils.validatePasswordStrength(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });
});
