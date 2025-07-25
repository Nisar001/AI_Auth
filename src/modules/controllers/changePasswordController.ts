import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { PasswordUtils } from '../../utils/passwordUtils';
import { asyncHandler } from '../../middlewares/errorHandler';
import { ChangePasswordInput } from '../../validations/authValidations';
import logger from '../../utils/logger';

export class ChangePasswordController {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  // Change password for authenticated user
  changePassword = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword }: ChangePasswordInput = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new ApiError(401, 'User not authenticated');
      }

      // Get user with password
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'email', 'password', 'tokenVersion', 'lastPasswordChange']
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      if (!user.password) {
        throw new ApiError(400, 'User account has no password set. Please use password reset instead.');
      }

      // Verify current password
      const isCurrentPasswordValid = await PasswordUtils.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        logger.warn(`Failed password change attempt for user ${user.email}: Invalid current password`);
        throw new ApiError(400, 'Current password is incorrect');
      }

      // Check if new password is different from current password
      const isSamePassword = await PasswordUtils.comparePassword(newPassword, user.password);
      if (isSamePassword) {
        throw new ApiError(400, 'New password must be different from current password');
      }

      // Hash new password
      const hashedNewPassword = await PasswordUtils.hashPassword(newPassword);

      // Update user password and increment token version (invalidate all existing tokens)
      await this.userRepository.update(userId, {
        password: hashedNewPassword,
        tokenVersion: user.tokenVersion + 1,
        lastPasswordChange: new Date()
      });

      logger.info(`Password changed successfully for user: ${user.email}`);

      res.status(200).json(
        ApiResponse.success(
          {
            message: 'Password changed successfully',
            timestamp: new Date().toISOString(),
            securityNote: 'All existing sessions have been invalidated. Please login again.'
          },
          'Password changed successfully. Please login again with your new password.',
          200
        )
      );
    } catch (error: any) {
      logger.error('Change password failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(500, 'Failed to change password');
    }
  });

  // Admin change password (for admin users to change other users' passwords)
  adminChangePassword = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { userId, newPassword, reason } = req.body;
      const adminUserId = (req as any).user?.id;
      const adminUser = (req as any).user;

      if (!adminUser || adminUser.role !== 'admin') {
        throw new ApiError(403, 'Insufficient permissions. Admin access required.');
      }

      // Get target user
      const targetUser = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'email', 'tokenVersion']
      });

      if (!targetUser) {
        throw new ApiError(404, 'Target user not found');
      }

      // Prevent admin from changing their own password via this endpoint
      if (adminUserId === userId) {
        throw new ApiError(400, 'Use the regular change password endpoint to change your own password');
      }

      // Hash new password
      const hashedNewPassword = await PasswordUtils.hashPassword(newPassword);

      // Update user password and increment token version
      await this.userRepository.update(userId, {
        password: hashedNewPassword,
        tokenVersion: targetUser.tokenVersion + 1,
        lastPasswordChange: new Date()
      });

      logger.warn(`Admin password change: Admin ${adminUser.email} changed password for user ${targetUser.email}. Reason: ${reason || 'No reason provided'}`);

      res.status(200).json(
        ApiResponse.success(
          {
            targetUserId: userId,
            targetUserEmail: targetUser.email,
            changedBy: adminUser.email,
            timestamp: new Date().toISOString(),
            reason: reason || 'No reason provided'
          },
          'User password changed successfully by admin',
          200
        )
      );
    } catch (error: any) {
      logger.error('Admin change password failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(500, 'Failed to change user password');
    }
  });
}
