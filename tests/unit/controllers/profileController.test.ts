// Mock dependencies FIRST, before any imports
jest.mock('../../../src/config/db', () => ({
  AppDataSource: {
    getRepository: jest.fn()
  }
}));

jest.mock('../../../src/utils/logger');

jest.mock('../../../src/middlewares/errorHandler', () => ({
  asyncHandler: (fn: Function) => {
    return async (req: any, res: any, next: any) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }
}));

// Now import everything else
import { Response, NextFunction } from 'express';
import { ProfileController } from '../../../src/modules/controllers/profileController';
import { User } from '../../../src/models/User';
import { AuthenticatedRequest } from '../../../src/middlewares/auth';
import { ApiError } from '../../../src/utils/ApiError';
import { createMockUser } from '../../utils/mockUser';

describe('ProfileController', () => {
  let profileController: ProfileController;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockUserRepository: any;

  beforeEach(() => {
    // Setup request and response mocks
    mockRequest = {
      user: createMockUser({
        id: 'test-user-id',
        email: 'john.doe@example.com'
      }),
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    // Setup repository mock
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn()
    };

    const { AppDataSource } = require('../../../src/config/db');
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepository);

    // Create controller instance
    profileController = new ProfileController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      // Arrange
      const mockUser = createMockUser({
        id: 'test-user-id',
        fname: 'John',
        lname: 'Doe',
        email: 'john.doe@example.com',
        phone: '1234567890',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      await profileController.getProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-user-id' }
      });
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: 'test-user-id',
              email: 'john.doe@example.com',
              fname: 'John',
              lname: 'Doe'
            })
          })
        })
      );
    });

    it('should handle user not found', async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      await profileController.getProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'User not found'
        })
      );
    });

    it('should handle missing user in request', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await profileController.getProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Authentication required'
        })
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockUserRepository.findOne.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await profileController.getProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Failed to retrieve profile. Please try again later.'
        })
      );
    });
  });

  describe('updateProfile', () => {
    it('should handle missing user in request', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await profileController.updateProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Authentication required'
        })
      );
    });

    it('should update user profile successfully', async () => {
      // Arrange
      mockRequest.body = {
        fname: 'Jane',
        lname: 'Smith',
        address: {
          city: 'New York',
          state: 'NY'
        }
      };

      const originalUser = createMockUser({
        id: 'test-user-id',
        fname: 'John',
        lname: 'Doe',
        city: 'Old City',
        state: 'Old State'
      });

      const updatedUser = createMockUser({
        ...originalUser,
        fname: 'Jane',
        lname: 'Smith',
        city: 'New York',
        state: 'NY'
      });

      mockUserRepository.findOne.mockResolvedValue(originalUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      // Act
      await profileController.updateProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-user-id' }
      });
      
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          fname: 'Jane',
          lname: 'Smith',
          city: 'New York',
          state: 'NY'
        })
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Profile updated successfully'
        })
      );
    });

    it('should handle partial profile updates', async () => {
      // Arrange
      mockRequest.body = {
        fname: 'UpdatedName'
      };

      const originalUser = createMockUser({
        id: 'test-user-id',
        fname: 'John',
        lname: 'Doe'
      });

      mockUserRepository.findOne.mockResolvedValue(originalUser);
      mockUserRepository.save.mockResolvedValue({
        ...originalUser,
        fname: 'UpdatedName'
      });

      // Act
      await profileController.updateProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          fname: 'UpdatedName',
          lname: 'Doe' // Should remain unchanged
        })
      );
    });

    it('should validate name fields', async () => {
      // Arrange
      mockRequest.body = {
        fname: '', // Empty name
        lname: 'Smith'
      };

      const originalUser = createMockUser({
        id: 'test-user-id'
      });

      mockUserRepository.findOne.mockResolvedValue(originalUser);

      // Act
      await profileController.updateProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'First name cannot be empty'
        })
      );
    });

    it('should handle date of birth updates with age validation', async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      mockRequest.body = {
        dob: futureDate.toISOString()
      };

      const originalUser = createMockUser({
        id: 'test-user-id'
      });

      mockUserRepository.findOne.mockResolvedValue(originalUser);

      // Act
      await profileController.updateProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'You must be at least 13 years old'
        })
      );
    });

    it('should handle user not found during update', async () => {
      // Arrange
      mockRequest.body = {
        fname: 'Jane'
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      await profileController.updateProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'User not found'
        })
      );
    });

    it('should sanitize input data', async () => {
      // Arrange
      mockRequest.body = {
        fname: '  Jane  ', // With extra spaces
        lname: '  Smith  ',
        address: {
          city: '  New York  ',
          street: '  Main St  '
        }
      };

      const originalUser = createMockUser({
        id: 'test-user-id'
      });

      mockUserRepository.findOne.mockResolvedValue(originalUser);
      mockUserRepository.save.mockResolvedValue(originalUser);

      // Act
      await profileController.updateProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          fname: 'Jane', // Trimmed
          lname: 'Smith', // Trimmed
          city: 'New York', // Trimmed
          street: 'Main St' // Trimmed
        })
      );
    });

    it('should handle database save errors', async () => {
      // Arrange
      mockRequest.body = {
        fname: 'Jane'
      };

      const originalUser = createMockUser({
        id: 'test-user-id'
      });

      mockUserRepository.findOne.mockResolvedValue(originalUser);
      mockUserRepository.save.mockRejectedValue(new Error('Database save failed'));

      // Act
      await profileController.updateProfile(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Failed to update profile. Please try again later.'
        })
      );
    });
  });
});
