import jwt from 'jsonwebtoken';
import { ApiError } from './ApiError';

export interface JwtPayload {
  userId: string;
  email: string;
  phone?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

export class JwtUtils {
  private static readonly JWT_SECRET = process.env.JWT_SECRET!;
  private static readonly REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;
  private static readonly JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
  private static readonly REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

  static generateAccessToken(payload: JwtPayload): string {
    try {
      return jwt.sign(payload, this.JWT_SECRET, {
        expiresIn: this.JWT_EXPIRY,
        issuer: 'ai-auth',
        audience: 'ai-auth-users'
      } as any);
    } catch (error) {
      throw new ApiError(500, 'Failed to generate access token');
    }
  }

  static generateRefreshToken(payload: RefreshTokenPayload): string {
    try {
      return jwt.sign(payload, this.REFRESH_TOKEN_SECRET, {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: 'ai-auth',
        audience: 'ai-auth-users'
      } as any);
    } catch (error) {
      throw new ApiError(500, 'Failed to generate refresh token');
    }
  }

  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET, {
        issuer: 'ai-auth',
        audience: 'ai-auth-users'
      }) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Access token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid access token');
      }
      throw new ApiError(401, 'Token verification failed');
    }
  }

  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: 'ai-auth',
        audience: 'ai-auth-users'
      }) as RefreshTokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Refresh token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid refresh token');
      }
      throw new ApiError(401, 'Refresh token verification failed');
    }
  }

  static getTokenFromHeader(authorization?: string): string {
    if (!authorization) {
      throw new ApiError(401, 'Authorization header is required');
    }

    const parts = authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new ApiError(401, 'Invalid authorization header format');
    }

    return parts[1];
  }

  static generateTempToken(payload: { userId: string }): string {
    try {
      return jwt.sign(payload, this.JWT_SECRET, {
        expiresIn: '10m', // Temporary token expires in 10 minutes
        issuer: 'ai-auth',
        audience: 'ai-auth-temp'
      } as any);
    } catch (error) {
      throw new ApiError(500, 'Failed to generate temporary token');
    }
  }

  static verifyTempToken(token: string): { userId: string } {
    try {
      return jwt.verify(token, this.JWT_SECRET, {
        issuer: 'ai-auth',
        audience: 'ai-auth-temp'
      }) as { userId: string };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Temporary token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid temporary token');
      }
      throw new ApiError(500, 'Failed to verify temporary token');
    }
  }
}
