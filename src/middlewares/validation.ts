import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../utils/logger';

export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Check if request body exists
      if (!req.body || Object.keys(req.body).length === 0) {
        res.status(400).json(
          ApiResponse.error('Request body is required', 400)
        );
        return;
      }

      // Validate against schema
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      
      // Log validation success for debugging
      logger.debug('Request validation successful', {
        path: req.path,
        method: req.method,
        fields: Object.keys(req.body)
      });
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format validation errors in a user-friendly way
        const errorMessages = error.errors.map(err => {
          const field = err.path.length > 0 ? err.path.join('.') : 'root';
          
          // Handle specific error types with better messages
          switch (err.code) {
            case 'invalid_type':
              return {
                field,
                message: `${field} must be of type ${err.expected}, received ${err.received}`
              };
            case 'too_small':
              if (err.type === 'string') {
                return {
                  field,
                  message: err.minimum === 1 
                    ? `${field} is required` 
                    : `${field} must be at least ${err.minimum} characters`
                };
              }
              return { field, message: err.message };
            case 'too_big':
              if (err.type === 'string') {
                return {
                  field,
                  message: `${field} must not exceed ${err.maximum} characters`
                };
              }
              return { field, message: err.message };
            case 'invalid_string':
              if (err.validation === 'email') {
                return { field, message: 'Please enter a valid email address' };
              }
              if (err.validation === 'regex') {
                return { field, message: err.message || `${field} format is invalid` };
              }
              return { field, message: err.message };
            case 'custom':
              return { field, message: err.message };
            default:
              return { field, message: err.message };
          }
        });

        // Group errors by field for better organization
        const groupedErrors = errorMessages.reduce((acc, error) => {
          if (!acc[error.field]) {
            acc[error.field] = [];
          }
          acc[error.field].push(error.message);
          return acc;
        }, {} as Record<string, string[]>);

        // Log validation errors for debugging
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: groupedErrors,
          ip: req.ip
        });

        res.status(400).json(
          ApiResponse.error(
            errorMessages.length > 0 ? errorMessages[0].message : 'Validation failed. Please check the required fields and try again.',
            400,
            errorMessages
          )
        );
        return;
      }

      // Handle other validation errors
      logger.error('Unexpected validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
        method: req.method
      });

      res.status(400).json(
        ApiResponse.error('Invalid request data. Please check your input and try again.', 400)
      );
    }
  };
};
