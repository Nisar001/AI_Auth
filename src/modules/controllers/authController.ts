import { Request, Response } from 'express';
import { RegisterController } from './registerController';
import { LoginController } from './loginController';
import { EmailVerificationController } from './emailVerificationController';
import { PhoneVerificationController } from './phoneVerificationController';
import { ForgotPasswordController } from './forgotPasswordController';
import { ResetPasswordController } from './resetPasswordController';
import { ResendOtpController } from './resendOtpController';
import { ProfileController } from './profileController';
import { TwoFAController } from './twoFAController';
import { UpdateEmailController } from './updateEmailController';
import { UpdatePhoneController } from './updatePhoneController';
import { SocialLoginController } from './socialLoginController';
import { JwtUtils } from '../../utils/jwtUtils';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { asyncHandler } from '../../middlewares/errorHandler';
import logger from '../../utils/logger';

export class AuthController {
  private registerController: RegisterController;
  private loginController: LoginController;
  private emailVerificationController: EmailVerificationController;
  private phoneVerificationController: PhoneVerificationController;
  private forgotPasswordController: ForgotPasswordController;
  private resetPasswordController: ResetPasswordController;
  private resendOtpController: ResendOtpController;
  private profileController: ProfileController;
  private twoFAController: TwoFAController;
  private updateEmailController: UpdateEmailController;
  private updatePhoneController: UpdatePhoneController;
  private socialLoginController: SocialLoginController;

  constructor() {
    this.registerController = new RegisterController();
    this.loginController = new LoginController();
    this.emailVerificationController = new EmailVerificationController();
    this.phoneVerificationController = new PhoneVerificationController();
    this.forgotPasswordController = new ForgotPasswordController();
    this.resetPasswordController = new ResetPasswordController();
    this.resendOtpController = new ResendOtpController();
    this.profileController = new ProfileController();
    this.twoFAController = new TwoFAController();
    this.updateEmailController = new UpdateEmailController();
    this.updatePhoneController = new UpdatePhoneController();
    this.socialLoginController = new SocialLoginController();
  }

  // Delegate methods to individual controllers  
  register = (req: Request, res: Response, next: any) => this.registerController.register(req, res, next);
  login = (req: Request, res: Response, next: any) => this.loginController.login(req, res, next);
  verifyEmail = (req: Request, res: Response, next: any) => this.emailVerificationController.verifyEmail(req, res, next);
  verifyPhone = (req: Request, res: Response, next: any) => this.phoneVerificationController.verifyPhone(req, res, next);
  forgotPassword = (req: Request, res: Response, next: any) => this.forgotPasswordController.forgotPassword(req, res, next);
  resetPassword = (req: Request, res: Response, next: any) => this.resetPasswordController.resetPassword(req, res, next);
  resendOtp = (req: Request, res: Response, next: any) => this.resendOtpController.resendOtp(req, res, next);
  getProfile = (req: AuthenticatedRequest, res: Response, next: any) => this.profileController.getProfile(req, res, next);
  updateProfile = (req: AuthenticatedRequest, res: Response, next: any) => this.profileController.updateProfile(req, res, next);
  updateEmail = (req: AuthenticatedRequest, res: Response, next: any) => this.updateEmailController.updateEmail(req, res, next);
  confirmEmailUpdate = (req: AuthenticatedRequest, res: Response, next: any) => this.updateEmailController.confirmUpdateEmail(req, res, next);
  updatePhone = (req: AuthenticatedRequest, res: Response, next: any) => this.updatePhoneController.updatePhone(req, res, next);
  confirmPhoneUpdate = (req: AuthenticatedRequest, res: Response, next: any) => this.updatePhoneController.confirmUpdatePhone(req, res, next);
  setup2FA = (req: AuthenticatedRequest, res: Response, next: any) => this.twoFAController.setup2FA(req, res, next);
  verify2FASetup = (req: AuthenticatedRequest, res: Response, next: any) => this.twoFAController.verify2FASetup(req, res, next);
  disable2FA = (req: AuthenticatedRequest, res: Response, next: any) => this.twoFAController.disable2FA(req, res, next);
  get2FAQRCode = (req: AuthenticatedRequest, res: Response, next: any) => this.twoFAController.get2FAQRCode(req, res, next);
  
  // Social Login delegate methods
  socialLogin = (req: Request, res: Response, next: any) => this.socialLoginController.socialLogin(req, res, next);
  getGoogleAuthUrl = (req: Request, res: Response, next: any) => this.socialLoginController.getGoogleAuthUrl(req, res, next);
  getGitHubAuthUrl = (req: Request, res: Response, next: any) => this.socialLoginController.getGitHubAuthUrl(req, res, next);
  googleCallback = (req: Request, res: Response, next: any) => this.socialLoginController.googleCallback(req, res, next);
  githubCallback = (req: Request, res: Response, next: any) => this.socialLoginController.githubCallback(req, res, next);

  // Refresh token method
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new ApiError(400, 'Refresh token is required');
      }

      // Verify refresh token
      const payload = JwtUtils.verifyRefreshToken(refreshToken);

      // TODO: Check if token version matches user's current token version
      // This would require storing token version in database

      // Generate new access token
      const newAccessToken = JwtUtils.generateAccessToken({
        userId: payload.userId,
        email: '', // Would need to fetch from database
        phone: '',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      logger.info('Token refreshed successfully', {
        userId: payload.userId
      });

      res.status(200).json(
        ApiResponse.success(
          {
            accessToken: newAccessToken,
            refreshToken // Return same refresh token
          },
          'Token refreshed successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Token refresh failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(401, 'Invalid refresh token');
    }
  });

  // Logout method
  logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // TODO: Invalidate the specific token (would require token blacklist)

      logger.info('User logged out successfully', {
        userId: userId
      });

      res.status(200).json(
        ApiResponse.success(
          {},
          'Logged out successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Logout failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Logout failed. Please try again later.');
    }
  });

  // Logout all method
  logoutAll = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new ApiError(401, 'Authentication required');
      }

      // TODO: Increment token version to invalidate all refresh tokens
      // This would require updating the user's tokenVersion in database

      logger.info('User logged out from all devices', {
        userId: userId
      });

      res.status(200).json(
        ApiResponse.success(
          {},
          'Logged out from all devices successfully',
          200
        )
      );
    } catch (error: any) {
      logger.error('Logout all failed:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, 'Logout all failed. Please try again later.');
    }
  });
}
