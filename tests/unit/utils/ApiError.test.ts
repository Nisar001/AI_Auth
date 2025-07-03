import { ApiError } from '../../../src/utils/ApiError';

describe('ApiError', () => {
  it('should create error with provided statusCode and message', () => {
    // Arrange & Act
    const error = new ApiError(400, 'Bad Request');
    
    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Bad Request');
    expect(error.isOperational).toBe(true);
    expect(error.errors).toEqual([]);
  });
  
  it('should use default message if not provided', () => {
    // Arrange & Act
    const error = new ApiError(500);
    
    // Assert
    expect(error.statusCode).toBe(500);
    expect(error.message).toBe('Something went wrong');
  });
  
  it('should store errors array if provided', () => {
    // Arrange
    const validationErrors = [
      { field: 'email', message: 'Email is required' },
      { field: 'password', message: 'Password is too short' }
    ];
    
    // Act
    const error = new ApiError(400, 'Validation Error', validationErrors);
    
    // Assert
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Validation Error');
    expect(error.errors).toEqual(validationErrors);
  });
  
  it('should use provided stack if provided', () => {
    // Arrange
    const customStack = 'Error: Custom stack trace\n    at Function.test (test.js:1:1)';
    
    // Act
    const error = new ApiError(500, 'Server Error', [], customStack);
    
    // Assert
    expect(error.stack).toBe(customStack);
  });
  
  it('should capture stack trace if stack not provided', () => {
    // Arrange & Act
    const error = new ApiError(404, 'Not Found');
    
    // Assert
    expect(error.stack).toBeDefined();
    expect(error.stack?.includes('ApiError')).toBe(true);
  });
  
  it('should be instanceof Error', () => {
    // Arrange & Act
    const error = new ApiError(400, 'Bad Request');
    
    // Assert
    expect(error).toBeInstanceOf(Error);
  });
  
  it('should be instanceof ApiError', () => {
    // Arrange & Act
    const error = new ApiError(400, 'Bad Request');
    
    // Assert
    expect(error).toBeInstanceOf(ApiError);
  });
  
  it('should handle complex error objects', () => {
    // Arrange
    const complexError = {
      name: 'ValidationError',
      details: {
        fields: {
          email: ['required', 'valid email format']
        }
      }
    };
    
    // Act
    const error = new ApiError(422, 'Validation failed', [complexError]);
    
    // Assert
    expect(error.statusCode).toBe(422);
    expect(error.message).toBe('Validation failed');
    expect(error.errors).toEqual([complexError]);
  });
});
