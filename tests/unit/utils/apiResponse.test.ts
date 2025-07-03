import { ApiResponse } from '../../../src/utils/ApiResponse';

describe('ApiResponse', () => {
  describe('success', () => {
    it('should create success response with data', () => {
      // Arrange
      const data = { user: { id: '1', name: 'John' } };
      const message = 'Operation successful';
      const statusCode = 200;

      // Act
      const result = ApiResponse.success(data, message, statusCode);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Operation successful',
        data: { user: { id: '1', name: 'John' } },
        statusCode: 200
      });
    });

    it('should create success response with default values', () => {
      // Act
      const result = ApiResponse.success({});

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Success',
        data: {},
        statusCode: 200
      });
    });

    it('should create success response with only data', () => {
      // Arrange
      const data = { count: 5 };

      // Act
      const result = ApiResponse.success(data);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Success',
        data: { count: 5 },
        statusCode: 200
      });
    });

    it('should create success response with custom status code', () => {
      // Act
      const result = ApiResponse.success({}, 'Created successfully', 201);

      // Assert
      expect(result.statusCode).toBe(201);
      expect(result.message).toBe('Created successfully');
    });

    it('should handle null data', () => {
      // Act
      const result = ApiResponse.success(null, 'No data available');

      // Assert
      expect(result.data).toBeNull();
      expect(result.success).toBe(true);
    });

    it('should handle complex nested data', () => {
      // Arrange
      const complexData = {
        users: [
          { id: 1, profile: { name: 'John', settings: { theme: 'dark' } } },
          { id: 2, profile: { name: 'Jane', settings: { theme: 'light' } } }
        ],
        pagination: { total: 2, page: 1, limit: 10 }
      };

      // Act
      const result = ApiResponse.success(complexData);

      // Assert
      expect(result.data).toEqual(complexData);
      expect(result.success).toBe(true);
    });
  });

  describe('error', () => {
    it('should create error response with message and status code', () => {
      // Arrange
      const message = 'Something went wrong';
      const statusCode = 500;

      // Act
      const result = ApiResponse.error(message, statusCode);

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Something went wrong',
        statusCode: 500,
        data: null
      });
    });

    it('should create error response with error data', () => {
      // Arrange
      const message = 'Validation failed';
      const statusCode = 400;
      const errorData = [
        { field: 'email', code: 'INVALID_FORMAT' }
      ];

      // Act
      const result = ApiResponse.error(message, statusCode, errorData);

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Validation failed',
        statusCode: 400,
        data: null,
        errors: [
          { field: 'email', code: 'INVALID_FORMAT' }
        ]
      });
    });

    it('should create error response with default status code', () => {
      // Act
      const result = ApiResponse.error('Default error');

      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Default error');
      expect(result.success).toBe(false);
    });

    it('should handle various HTTP error codes', () => {
      // Test common error codes
      const testCases = [
        { code: 400, name: 'Bad Request' },
        { code: 401, name: 'Unauthorized' },
        { code: 403, name: 'Forbidden' },
        { code: 404, name: 'Not Found' },
        { code: 422, name: 'Unprocessable Entity' },
        { code: 500, name: 'Internal Server Error' }
      ];

      testCases.forEach(({ code, name }) => {
        const result = ApiResponse.error(`${name} error`, code);
        expect(result.statusCode).toBe(code);
        expect(result.success).toBe(false);
      });
    });

    it('should handle array of errors', () => {
      // Arrange
      const errors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Password too short' }
      ];

      // Act
      const result = ApiResponse.error('Validation errors', 400, errors);

      // Assert
      expect(result.errors).toEqual(errors);
    });

    it('should handle empty error data', () => {
      // Act
      const result = ApiResponse.error('Error message', 400, []);

      // Assert
      expect(result.errors).toEqual([]);
    });
  });

  describe('response structure consistency', () => {
    it('should always include required fields in success response', () => {
      // Act
      const result = ApiResponse.success({});

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('statusCode');
    });

    it('should always include required fields in error response', () => {
      // Act
      const result = ApiResponse.error('Test error');

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('data');
    });

    it('should not include errors field when no errors provided', () => {
      // Act
      const result = ApiResponse.error('Test error');

      // Assert
      expect(result).not.toHaveProperty('errors');
    });

    it('should include errors field when errors provided', () => {
      // Act
      const result = ApiResponse.error('Test error', 400, ['error1']);

      // Assert
      expect(result).toHaveProperty('errors');
      expect(result.errors).toEqual(['error1']);
    });
  });

  describe('constructor', () => {
    it('should create response with constructor', () => {
      // Act
      const result = new ApiResponse(201, 'Created', { id: 1 }, true);

      // Assert
      expect(result.statusCode).toBe(201);
      expect(result.message).toBe('Created');
      expect(result.data).toEqual({ id: 1 });
      expect(result.success).toBe(true);
    });

    it('should auto-determine success based on status code', () => {
      // Act
      const successResult = new ApiResponse(200, 'OK', {});
      const errorResult = new ApiResponse(400, 'Bad Request', {});

      // Assert
      expect(successResult.success).toBe(true);
      expect(errorResult.success).toBe(false);
    });

    it('should allow explicit success override', () => {
      // Act
      const result = new ApiResponse(500, 'Server Error', {}, true);

      // Assert
      expect(result.success).toBe(true); // Explicitly set to true despite 500 status
    });
  });
});
