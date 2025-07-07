import { Request, Response, NextFunction } from 'express';
import { JwtUtils, JwtPayload } from '../utils/jwtUtils';
import { ApiResponse } from '../utils/ApiResponse';
import { AppDataSource } from '../config/db';
import { User } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: User;
  tokenPayload?: JwtPayload;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  console.log(`Debug: authenticateToken middleware executed for ${req.path}`);
  try {
    const token = JwtUtils.getTokenFromHeader(req.headers.authorization);
    const payload = JwtUtils.verifyAccessToken(token);
    
    // Fetch user from database to ensure user still exists
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: payload.userId }
    });

    if (!user) {
      res.status(401).json(
        ApiResponse.error('User not found', 401)
      );
      return;
    }

    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (error: any) {
    res.status(401).json(
      ApiResponse.error(error.message || 'Authentication failed', 401)
    );
  }
};

export const requireEmailVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isEmailVerified) {
    res.status(403).json(
      ApiResponse.error('Email verification required', 403)
    );
    return;
  }
  next();
};

export const requirePhoneVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isPhoneVerified) {
    res.status(403).json(
      ApiResponse.error('Phone verification required', 403)
    );
    return;
  }
  next();
};

export const requireFullVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isEmailVerified || !req.user?.isPhoneVerified) {
    res.status(403).json(
      ApiResponse.error('Both email and phone verification required', 403)
    );
    return;
  }
  next();
};
