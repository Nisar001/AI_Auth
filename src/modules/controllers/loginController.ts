import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { PasswordUtils } from '../../utils/passwordUtils';
import { PhoneUtils } from '../../utils/phoneUtils';
import { JwtUtils, JwtPayload } from '../../utils/jwtUtils';
import { LoginInput } from '../../validations/authValidations';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class LoginController {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  login = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { identifier, password }: LoginInput = req.body;

      // Sanitize input
      const sanitizedIdentifier = identifier.toLowerCase().trim();
      const sanitizedPassword = password.trim();

      if (!sanitizedIdentifier || !sanitizedPassword) {
        throw new ApiError(400, 'Email/phone and password are required');
      }

      // Find user by email or phone with proper phone number handling
      let user = await this.userRepository.findOne({
        where: { email: sanitizedIdentifier }
      });

      // If not found by email and identifier looks like a phone number, try phone matching
      if (!user && (sanitizedIdentifier.startsWith('+') || /^\d+$/.test(sanitizedIdentifier))) {
        // Use phone utility for comprehensive phone matching
        const searchFormats = PhoneUtils.generateSearchFormats(sanitizedIdentifier);
        
        // Try direct phone match first
        for (const format of searchFormats) {
          user = await this.userRepository.findOne({
            where: { phone: format }
          });
          if (user) break;
        }
        
        // If not found, try country code + phone combination
        if (!user) {
          const parsed = PhoneUtils.parsePhoneNumber(sanitizedIdentifier);
          if (parsed.countryCode && parsed.phoneNumber) {
            user = await this.userRepository.findOne({
              where: { 
                phone: parsed.phoneNumber, 
                countryCode: parsed.countryCode 
              }
            });
          }
        }
        
        // If still not found, try finding any user and check if phone matches
        if (!user) {
          const allUsers = await this.userRepository.find();
          user = allUsers.find(u => 
            PhoneUtils.isPhoneMatch(sanitizedIdentifier, u.phone, u.countryCode)
          ) || null;
        }
      }

      if (!user) {
        // Log failed login attempt
        logger.warn('Login attempt with non-existent user', {
          identifier: sanitizedIdentifier,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        throw new ApiError(401, 'Invalid credentials');
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const lockTimeRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
        throw new ApiError(423, `Account is locked. Try again in ${lockTimeRemaining} minutes.`);
      }

      // Verify password
      const isPasswordValid = await PasswordUtils.comparePassword(sanitizedPassword, user.password || '');

      if (!isPasswordValid) {
        // Increment login attempts
        user.loginAttempts = (user.loginAttempts || 0) + 1;

        // Lock account after 5 failed attempts
        if (user.loginAttempts >= 5) {
          user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          logger.warn('Account locked due to multiple failed login attempts', {
            userId: user.id,
            email: user.email,
            attempts: user.loginAttempts
          });
        }

        await this.userRepository.save(user);

        logger.warn('Failed login attempt', {
          userId: user.id,
          identifier: sanitizedIdentifier,
          attempts: user.loginAttempts,
          ip: req.ip
        });

        throw new ApiError(401, 'Invalid credentials');
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        user.loginAttempts = 0;
        user.lockedUntil = undefined;
      }

      // Check if email and phone are verified (REQUIRED for login)
      if (!user.isEmailVerified) {
        throw new ApiError(403, 'Please verify your email address before logging in');
      }

      if (!user.isPhoneVerified) {
        throw new ApiError(403, 'Please verify your phone number before logging in');
      }

      // Update last login
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      // Check if 2FA is enabled
      if (user.is2FAEnabled) {
        // Generate temporary token for 2FA process
        const tempToken = JwtUtils.generateTempToken({ userId: user.id });
        
        // Get available 2FA methods - ensure we have valid methods
        let availableMethods: string[] = [];
        if (user.preferred2FAMethods) {
          availableMethods = user.preferred2FAMethods.split(',').filter(method => method.trim());
        }
        
        // If no methods found but 2FA is enabled, provide default methods based on verification status
        if (availableMethods.length === 0) {
          if (user.isEmailVerified) availableMethods.push('email');
          if (user.isPhoneVerified) availableMethods.push('sms');
          if (user.twoFASecret) availableMethods.push('auth_app');
          
          // Update user's preferred methods if we had to determine them
          if (availableMethods.length > 0) {
            user.preferred2FAMethods = availableMethods.join(',');
            await this.userRepository.save(user);
          }
        }
        
        // If still no methods available, disable 2FA temporarily
        if (availableMethods.length === 0) {
          logger.warn('2FA enabled but no valid methods available, disabling 2FA', {
            userId: user.id,
            email: user.email
          });
          
          user.is2FAEnabled = false;
          user.preferred2FAMethods = '';
          await this.userRepository.save(user);
        } else {
          logger.info('2FA required for login', { 
            userId: user.id, 
            email: user.email,
            availableMethods 
          });
          
          return res.status(200).json(
            ApiResponse.success(
              { 
                requires2FA: true,
                tempToken,
                availableMethods,
                message: 'Two-factor authentication required'
              },
              'Two-factor authentication required',
              200
            )
          );
        }
      }

      // Generate JWT tokens
      const tokenPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified
      };

      const accessToken = JwtUtils.generateAccessToken(tokenPayload);
      const refreshToken = JwtUtils.generateRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion
      });

      // Prepare response data
      const responseData = {
        user: {
          id: user.id,
          fname: user.fname,
          mname: user.mname,
          lname: user.lname,
          email: user.email,
          phone: user.phone,
          countryCode: user.countryCode,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          is2FAEnabled: user.is2FAEnabled,
          authType: user.authType,
          lastLogin: user.lastLoginAt
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };

      logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.status(200).json(
        ApiResponse.success(
          responseData,
          'Login successful',
          200
        )
      );
    } catch (error: any) {
      logger.error('Login failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle database errors
      if (error.name === 'QueryFailedError') {
        throw new ApiError(500, 'Database error occurred. Please try again.');
      }

      throw new ApiError(500, 'Login failed. Please try again later.');
    }
  });
}
