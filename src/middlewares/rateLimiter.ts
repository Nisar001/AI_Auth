import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../utils/ApiResponse';

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: () => ApiResponse.error('Too many requests, please try again later', 429),
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
  message: () => ApiResponse.error('Too many authentication attempts, please try again later', 429),
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP rate limiter
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 3 OTP requests per 5 minutes
  message: () => ApiResponse.error('Too many OTP requests, please try again in 5 minutes', 429),
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset rate limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 password reset attempts per 15 minutes
  message: () => ApiResponse.error('Too many password reset attempts, please try again later', 429),
  standardHeaders: true,
  legacyHeaders: false,
});
