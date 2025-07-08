import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../utils/logger';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let err = error;

  // Log the error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle different types of errors
  if (!(err instanceof ApiError)) {
    // Handle MongoDB/TypeORM specific errors
    if (err.name === 'QueryFailedError') {
      const message = err.message.includes('duplicate key') 
        ? 'This email or phone number is already registered'
        : 'Database operation failed';
      err = new ApiError(400, message);
    }
    // Handle validation errors
    else if (err.name === 'ValidationError') {
      const message = Object.values(err.errors || {}).map((val: any) => val.message).join(', ');
      err = new ApiError(400, message);
    }
    // Handle JWT errors
    else if (err.name === 'JsonWebTokenError') {
      err = new ApiError(401, 'Invalid token');
    }
    else if (err.name === 'TokenExpiredError') {
      err = new ApiError(401, 'Token expired');
    }
    // Handle other errors
    else {
      err = new ApiError(500, process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message
      );
    }
  }

  res.status(err.statusCode || 500).json(
    ApiResponse.error(
      err.message,
      err.statusCode || 500,
      err.errors
    )
  );
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json(
    ApiResponse.error(`Route ${req.originalUrl} not found`, 404)
  );
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
