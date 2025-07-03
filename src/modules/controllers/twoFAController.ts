import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/db';
import { User } from '../../models/User';
import { OtpService } from '../../services/otpService';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { PasswordUtils } from '../../utils/passwordUtils';
import { Setup2FAInput, Verify2FAInput } from '../../validations/authValidations';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class TwoFAController {
  // ...existing code...

  // Raw async method for direct testing (bypasses asyncHandler)
  public disable2FARaw = async (req: AuthenticatedRequest, res: Response, next: Function) => {
    try {
      const userId = req.user?.id;
      const { password } = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      if (!password) {
        throw new ApiError(400, 'Password is required to disable 2FA');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if 2FA is enabled
      if (!user.is2FAEnabled) {
        throw new ApiError(400, '2FA is not enabled for this account');
      }

      // Verify current password
      if (!user.password) {
        throw new ApiError(400, 'Password verification required');
      }

      const isPasswordValid = await PasswordUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password');
      }

      // Disable 2FA
      user.is2FAEnabled = false;
      user.twoFASecret = undefined;
      user.preferred2FAMethods = '';

      await this.userRepository.save(user);

      logger.info('2FA disabled successfully', {
        userId: user.id,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          {
            is2FAEnabled: false,
            message: '2FA has been disabled for your account'
          },
          '2FA has been successfully disabled',
          200
        )
      );
    } catch (error: any) {
      logger.error('2FA disable failed:', error);
      if (error instanceof ApiError) {
        return next(error);
      }
      return next(new ApiError(500, 'Failed to disable 2FA. Please try again later.'));
    }
  };

  // Raw async method for direct testing (bypasses asyncHandler)
  public get2FAQRCodeRaw = async (req: AuthenticatedRequest, res: Response, next: Function) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Generate new QR code for authenticator app
      const { secret, qrCode } = await this.otpService.generateSecretFor2FA(user.id);

      logger.info('2FA QR code generated', {
        userId: user.id,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          {
            qrCode,
            secret,
            instructions: [
              '1. Install an authenticator app (Google Authenticator, Authy, etc.)',
              '2. Scan the QR code with your authenticator app',
              '3. Enter the 6-digit code from your app to verify setup'
            ]
          },
          'QR code generated for 2FA setup',
          200
        )
      );
    } catch (error: any) {
      logger.error('2FA QR code generation failed:', error);
      if (error instanceof ApiError) {
        return next(error);
      }
      return next(new ApiError(500, 'Failed to generate QR code. Please try again later.'));
    }
  };
  // Raw async method for direct testing (bypasses asyncHandler)
  public setup2FARaw = async (req: AuthenticatedRequest, res: Response, next: Function) => {
    try {
      const userId = req.user?.id;
      const { method, password }: Setup2FAInput = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Verify current password
      if (!user.password) {
        throw new ApiError(400, 'Password verification required');
      }

      const isPasswordValid = await PasswordUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password');
      }

      // Check if 2FA is already enabled
      if (user.is2FAEnabled) {
        throw new ApiError(400, '2FA is already enabled for this account');
      }

      // Validate method
      if (!['email', 'sms', 'auth_app'].includes(method)) {
        throw new ApiError(400, 'Invalid 2FA method');
      }

      // Check if contact method is verified
      if (method === 'email' && !user.isEmailVerified) {
        throw new ApiError(400, 'Email must be verified before enabling email 2FA');
      }

      if (method === 'sms' && !user.isPhoneVerified) {
        throw new ApiError(400, 'Phone number must be verified before enabling SMS 2FA');
      }

      let responseData: any = {
        method,
        status: 'setup_initiated'
      };

      if (method === 'auth_app') {
        // Generate QR code for authenticator app
        const { secret, qrCode } = await this.otpService.generateSecretFor2FA(user.id);
        responseData.qrCode = qrCode;
        responseData.secret = secret;
        responseData.instructions = [
          '1. Install an authenticator app (Google Authenticator, Authy, etc.)',
          '2. Scan the QR code with your authenticator app',
          '3. Enter the 6-digit code from your app to verify setup'
        ];
      } else {
        // Send verification code via email or SMS
        await this.otpService.generateAndSendOtp(user, method, '2fa_setup');
        responseData.instructions = [
          `1. Check your ${method === 'email' ? 'email' : 'phone'} for a verification code`,
          '2. Enter the 6-digit code to complete 2FA setup'
        ];
      }

      logger.info('2FA setup initiated', {
        userId: user.id,
        method,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          responseData,
          `2FA setup initiated using ${method}. Please follow the instructions to complete setup.`,
          200
        )
      );
    } catch (error: any) {
      logger.error('2FA setup failed:', error);
      if (error instanceof ApiError) {
        return next(error);
      }
      return next(new ApiError(500, '2FA setup failed. Please try again later.'));
    }
  };

  // Raw async method for direct testing (bypasses asyncHandler)
  public verify2FASetupRaw = async (req: AuthenticatedRequest, res: Response, next: Function) => {
    try {
      const userId = req.user?.id;
      const { code, method }: Verify2FAInput = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if 2FA is already enabled
      if (user.is2FAEnabled) {
        throw new ApiError(400, '2FA is already enabled for this account');
      }

      // Verify the code
      const verificationResult = await this.otpService.verifyOtp(userId, code, method);
      if (!verificationResult.isValid) {
        throw new ApiError(400, 'Invalid or expired verification code');
      }

      // Enable 2FA for the user
      user.is2FAEnabled = true;

      // Update preferred 2FA methods - ensure method is properly set
      let currentMethods: string[] = [];
      if (user.preferred2FAMethods) {
        currentMethods = user.preferred2FAMethods.split(',').filter(m => m.trim());
      }

      // Add the current method if not already present
      if (!currentMethods.includes(method)) {
        currentMethods.push(method);
      }

      // Always ensure we have at least the current method
      user.preferred2FAMethods = currentMethods.length > 0 ? currentMethods.join(',') : method;

      // Store 2FA secret for auth_app method
      if (method === 'auth_app' && verificationResult.otpRecord?.secret) {
        user.twoFASecret = verificationResult.otpRecord.secret;
      }

      await this.userRepository.save(user);

      logger.info('2FA enabled successfully', {
        userId: user.id,
        method,
        enabledMethods: user.preferred2FAMethods,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          {
            is2FAEnabled: true,
            enabledMethods: user.preferred2FAMethods?.split(',') || [method],
            backupCodes: [] // TODO: Generate backup codes
          },
          '2FA has been successfully enabled for your account',
          200
        )
      );
    } catch (error: any) {
      logger.error('2FA verification failed:', error);
      if (error instanceof ApiError) {
        return next(error);
      }
      return next(new ApiError(500, '2FA verification failed. Please try again later.'));
    }
  };
  // Raw async method for direct testing (bypasses asyncHandler)
  public addAdditional2FAMethodRaw = async (req: AuthenticatedRequest, res: Response, next: Function) => {
    try {
      const userId = req.user?.id;
      const { method, password }: Setup2FAInput = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Verify current password
      if (!user.password) {
        throw new ApiError(400, 'Password verification required');
      }

      const isPasswordValid = await PasswordUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password');
      }

      // Check if 2FA is enabled
      if (!user.is2FAEnabled) {
        throw new ApiError(400, '2FA must be enabled first before adding additional methods');
      }

      // Check if method is already enabled
      const currentMethods = user.preferred2FAMethods?.split(',') || [];
      if (currentMethods.includes(method)) {
        throw new ApiError(400, `${method} is already enabled for 2FA`);
      }

      // Validate method
      if (!['email', 'sms', 'auth_app'].includes(method)) {
        throw new ApiError(400, 'Invalid 2FA method');
      }

      // Check if contact method is verified
      if (method === 'email' && !user.isEmailVerified) {
        throw new ApiError(400, 'Email must be verified before enabling email 2FA');
      }

      if (method === 'sms' && !user.isPhoneVerified) {
        throw new ApiError(400, 'Phone number must be verified before enabling SMS 2FA');
      }

      let responseData: any = {
        method,
        status: 'additional_method_setup_initiated'
      };

      if (method === 'auth_app') {
        // Generate QR code for authenticator app
        const { secret, qrCode } = await this.otpService.generateSecretFor2FA(user.id);
        responseData.qrCode = qrCode;
        responseData.secret = secret;
        responseData.instructions = [
          '1. Open your authenticator app',
          '2. Scan the QR code to add this account',
          '3. Enter the 6-digit code from your app to verify setup'
        ];
      } else {
        // Send verification code via email or SMS
        await this.otpService.generateAndSendOtp(user, method, '2fa_additional_setup');
        responseData.instructions = [
          `1. Check your ${method === 'email' ? 'email' : 'phone'} for a verification code`,
          '2. Enter the 6-digit code to add this 2FA method'
        ];
      }

      logger.info('Additional 2FA method setup initiated', {
        userId: user.id,
        method,
        currentMethods: user.preferred2FAMethods,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          responseData,
          `Additional 2FA method (${method}) setup initiated. Please follow the instructions to complete setup.`,
          200
        )
      );
    } catch (error: any) {
      logger.error('Additional 2FA method setup failed:', error);
      if (error instanceof ApiError) {
        return next(error);
      }
      return next(new ApiError(500, 'Additional 2FA method setup failed. Please try again later.'));
    }
  };

  // Raw async method for direct testing (bypasses asyncHandler)
  public verifyAdditional2FAMethodRaw = async (req: AuthenticatedRequest, res: Response, next: Function) => {
    try {
      const userId = req.user?.id;
      const { code, method }: Verify2FAInput = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if 2FA is enabled
      if (!user.is2FAEnabled) {
        throw new ApiError(400, '2FA must be enabled first');
      }

      // Check if method is already enabled
      const currentMethods = user.preferred2FAMethods?.split(',') || [];
      if (currentMethods.includes(method)) {
        throw new ApiError(400, `${method} is already enabled for 2FA`);
      }

      // Verify the code
      const verificationResult = await this.otpService.verifyOtp(userId, code, method);
      if (!verificationResult.isValid) {
        throw new ApiError(400, 'Invalid or expired verification code');
      }

      // Add the new method to preferred methods
      currentMethods.push(method);
      user.preferred2FAMethods = currentMethods.join(',');

      // Store 2FA secret for auth_app method
      if (method === 'auth_app' && verificationResult.otpRecord?.secret) {
        user.twoFASecret = verificationResult.otpRecord.secret;
      }

      await this.userRepository.save(user);

      logger.info('Additional 2FA method enabled successfully', {
        userId: user.id,
        method,
        allMethods: user.preferred2FAMethods,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          {
            is2FAEnabled: true,
            enabledMethods: user.preferred2FAMethods.split(','),
            newMethod: method,
            message: `${method} has been successfully added to your 2FA methods`
          },
          `${method} has been successfully added to your 2FA methods`,
          200
        )
      );
    } catch (error: any) {
      logger.error('Additional 2FA method verification failed:', error);
      if (error instanceof ApiError) {
        return next(error);
      }
      return next(new ApiError(500, 'Additional 2FA method verification failed. Please try again later.'));
    }
  };
  private userRepository: Repository<User>;
  private otpService: OtpService;

  constructor(
    userRepository?: Repository<User>,
    otpService?: OtpService
  ) {
    this.userRepository = userRepository || AppDataSource.getRepository(User);
    this.otpService = otpService || new OtpService();
  }

  setup2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { method, password }: Setup2FAInput = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Verify current password
      if (!user.password) {
        throw new ApiError(400, 'Password verification required');
      }

      const isPasswordValid = await PasswordUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password');
      }

      // Check if 2FA is already enabled
      if (user.is2FAEnabled) {
        throw new ApiError(400, '2FA is already enabled for this account');
      }

      // Validate method
      if (!['email', 'sms', 'auth_app'].includes(method)) {
        throw new ApiError(400, 'Invalid 2FA method');
      }

      // Check if contact method is verified
      if (method === 'email' && !user.isEmailVerified) {
        throw new ApiError(400, 'Email must be verified before enabling email 2FA');
      }

      if (method === 'sms' && !user.isPhoneVerified) {
        throw new ApiError(400, 'Phone number must be verified before enabling SMS 2FA');
      }

      let responseData: any = {
        method,
        status: 'setup_initiated'
      };

      if (method === 'auth_app') {
        // Generate QR code for authenticator app
        const { secret, qrCode } = await this.otpService.generateSecretFor2FA(user.id);
        responseData.qrCode = qrCode;
        responseData.secret = secret;
        responseData.instructions = [
          '1. Install an authenticator app (Google Authenticator, Authy, etc.)',
          '2. Scan the QR code with your authenticator app',
          '3. Enter the 6-digit code from your app to verify setup'
        ];
      } else {
        // Send verification code via email or SMS
        await this.otpService.generateAndSendOtp(user, method, '2fa_setup');
        responseData.instructions = [
          `1. Check your ${method === 'email' ? 'email' : 'phone'} for a verification code`,
          '2. Enter the 6-digit code to complete 2FA setup'
        ];
      }

      logger.info('2FA setup initiated', {
        userId: user.id,
        method,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          responseData,
          `2FA setup initiated using ${method}. Please follow the instructions to complete setup.`,
          200
        )
      );
    } catch (error: any) {
      logger.error('2FA setup failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, '2FA setup failed. Please try again later.');
    }
  });

  verify2FASetup = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { code, method }: Verify2FAInput = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if 2FA is already enabled
      if (user.is2FAEnabled) {
        throw new ApiError(400, '2FA is already enabled for this account');
      }

      // Verify the code
      const verificationResult = await this.otpService.verifyOtp(userId, code, method);
      
      if (!verificationResult.isValid) {
        throw new ApiError(400, 'Invalid or expired verification code');
      }

      // Enable 2FA for the user
      user.is2FAEnabled = true;
      
      // Update preferred 2FA methods - ensure method is properly set
      let currentMethods: string[] = [];
      if (user.preferred2FAMethods) {
        currentMethods = user.preferred2FAMethods.split(',').filter(m => m.trim());
      }
      
      // Add the current method if not already present
      if (!currentMethods.includes(method)) {
        currentMethods.push(method);
      }
      
      // Always ensure we have at least the current method
      user.preferred2FAMethods = currentMethods.length > 0 ? currentMethods.join(',') : method;

      // Store 2FA secret for auth_app method
      if (method === 'auth_app' && verificationResult.otpRecord?.secret) {
        user.twoFASecret = verificationResult.otpRecord.secret;
      }

      await this.userRepository.save(user);

      logger.info('2FA enabled successfully', {
        userId: user.id,
        method,
        enabledMethods: user.preferred2FAMethods,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          {
            is2FAEnabled: true,
            enabledMethods: user.preferred2FAMethods?.split(',') || [method],
            backupCodes: [] // TODO: Generate backup codes
          },
          '2FA has been successfully enabled for your account',
          200
        )
      );
    } catch (error: any) {
      logger.error('2FA verification failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, '2FA verification failed. Please try again later.');
    }
  });

  disable2FA = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { password } = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      if (!password) {
        throw new ApiError(400, 'Password is required to disable 2FA');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if 2FA is enabled
      if (!user.is2FAEnabled) {
        throw new ApiError(400, '2FA is not enabled for this account');
      }

      // Verify current password
      if (!user.password) {
        throw new ApiError(400, 'Password verification required');
      }

      const isPasswordValid = await PasswordUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password');
      }

      // Disable 2FA
      user.is2FAEnabled = false;
      user.twoFASecret = undefined;
      user.preferred2FAMethods = '';

      await this.userRepository.save(user);

      logger.info('2FA disabled successfully', {
        userId: user.id,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          {
            is2FAEnabled: false,
            message: '2FA has been disabled for your account'
          },
          '2FA has been successfully disabled',
          200
        )
      );
    } catch (error: any) {
      logger.error('2FA disable failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Failed to disable 2FA. Please try again later.');
    }
  });

  get2FAQRCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Generate new QR code for authenticator app
      const { secret, qrCode } = await this.otpService.generateSecretFor2FA(user.id);

      logger.info('2FA QR code generated', {
        userId: user.id,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          {
            qrCode,
            secret,
            instructions: [
              '1. Install an authenticator app (Google Authenticator, Authy, etc.)',
              '2. Scan the QR code with your authenticator app',
              '3. Enter the 6-digit code from your app to verify setup'
            ]
          },
          'QR code generated for 2FA setup',
          200
        )
      );
    } catch (error: any) {
      logger.error('2FA QR code generation failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Failed to generate QR code. Please try again later.');
    }
  });

  // Add additional 2FA method to existing 2FA setup
  addAdditional2FAMethod = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { method, password }: Setup2FAInput = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Verify current password
      if (!user.password) {
        throw new ApiError(400, 'Password verification required');
      }

      const isPasswordValid = await PasswordUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password');
      }

      // Check if 2FA is enabled
      if (!user.is2FAEnabled) {
        throw new ApiError(400, '2FA must be enabled first before adding additional methods');
      }

      // Check if method is already enabled
      const currentMethods = user.preferred2FAMethods?.split(',') || [];
      if (currentMethods.includes(method)) {
        throw new ApiError(400, `${method} is already enabled for 2FA`);
      }

      // Validate method
      if (!['email', 'sms', 'auth_app'].includes(method)) {
        throw new ApiError(400, 'Invalid 2FA method');
      }

      // Check if contact method is verified
      if (method === 'email' && !user.isEmailVerified) {
        throw new ApiError(400, 'Email must be verified before enabling email 2FA');
      }

      if (method === 'sms' && !user.isPhoneVerified) {
        throw new ApiError(400, 'Phone number must be verified before enabling SMS 2FA');
      }

      let responseData: any = {
        method,
        status: 'additional_method_setup_initiated'
      };

      if (method === 'auth_app') {
        // Generate QR code for authenticator app
        const { secret, qrCode } = await this.otpService.generateSecretFor2FA(user.id);
        responseData.qrCode = qrCode;
        responseData.secret = secret;
        responseData.instructions = [
          '1. Open your authenticator app',
          '2. Scan the QR code to add this account',
          '3. Enter the 6-digit code from your app to verify setup'
        ];
      } else {
        // Send verification code via email or SMS
        await this.otpService.generateAndSendOtp(user, method, '2fa_additional_setup');
        responseData.instructions = [
          `1. Check your ${method === 'email' ? 'email' : 'phone'} for a verification code`,
          '2. Enter the 6-digit code to add this 2FA method'
        ];
      }

      logger.info('Additional 2FA method setup initiated', {
        userId: user.id,
        method,
        currentMethods: user.preferred2FAMethods,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          responseData,
          `Additional 2FA method (${method}) setup initiated. Please follow the instructions to complete setup.`,
          200
        )
      );
    } catch (error: any) {
      logger.error('Additional 2FA method setup failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Additional 2FA method setup failed. Please try again later.');
    }
  });

  // Verify additional 2FA method setup
  verifyAdditional2FAMethod = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { code, method }: Verify2FAInput = req.body;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check if 2FA is enabled
      if (!user.is2FAEnabled) {
        throw new ApiError(400, '2FA must be enabled first');
      }

      // Check if method is already enabled
      const currentMethods = user.preferred2FAMethods?.split(',') || [];
      if (currentMethods.includes(method)) {
        throw new ApiError(400, `${method} is already enabled for 2FA`);
      }

      // Verify the code
      const verificationResult = await this.otpService.verifyOtp(userId, code, method);
      
      if (!verificationResult.isValid) {
        throw new ApiError(400, 'Invalid or expired verification code');
      }

      // Add the new method to preferred methods
      currentMethods.push(method);
      user.preferred2FAMethods = currentMethods.join(',');

      // Store 2FA secret for auth_app method
      if (method === 'auth_app' && verificationResult.otpRecord?.secret) {
        user.twoFASecret = verificationResult.otpRecord.secret;
      }

      await this.userRepository.save(user);

      logger.info('Additional 2FA method enabled successfully', {
        userId: user.id,
        method,
        allMethods: user.preferred2FAMethods,
        email: user.email
      });

      res.status(200).json(
        ApiResponse.success(
          {
            is2FAEnabled: true,
            enabledMethods: user.preferred2FAMethods.split(','),
            newMethod: method,
            message: `${method} has been successfully added to your 2FA methods`
          },
          `${method} has been successfully added to your 2FA methods`,
          200
        )
      );
    } catch (error: any) {
      logger.error('Additional 2FA method verification failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Additional 2FA method verification failed. Please try again later.');
    }
  });
}
