
// Mock all sub-controller classes before importing AuthController
jest.mock('../../../src/modules/controllers/registerController', () => ({ RegisterController: jest.fn().mockImplementation(() => ({ register: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/loginController', () => ({ LoginController: jest.fn().mockImplementation(() => ({ login: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/emailVerificationController', () => ({ EmailVerificationController: jest.fn().mockImplementation(() => ({ verifyEmail: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/phoneVerificationController', () => ({ PhoneVerificationController: jest.fn().mockImplementation(() => ({ verifyPhone: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/forgotPasswordController', () => ({ ForgotPasswordController: jest.fn().mockImplementation(() => ({ forgotPassword: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/resetPasswordController', () => ({ ResetPasswordController: jest.fn().mockImplementation(() => ({ resetPassword: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/resendOtpController', () => ({ ResendOtpController: jest.fn().mockImplementation(() => ({ resendOtp: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/profileController', () => ({ ProfileController: jest.fn().mockImplementation(() => ({ getProfile: jest.fn(), updateProfile: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/updateEmailController', () => ({ UpdateEmailController: jest.fn().mockImplementation(() => ({ updateEmail: jest.fn(), confirmUpdateEmail: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/updatePhoneController', () => ({ UpdatePhoneController: jest.fn().mockImplementation(() => ({ updatePhone: jest.fn(), confirmUpdatePhone: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/twoFAController', () => ({ TwoFAController: jest.fn().mockImplementation(() => ({ setup2FA: jest.fn(), verify2FASetup: jest.fn(), disable2FA: jest.fn(), get2FAQRCode: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/socialLoginController', () => ({ SocialLoginController: jest.fn().mockImplementation(() => ({ socialLogin: jest.fn(), getGoogleAuthUrl: jest.fn(), getGitHubAuthUrl: jest.fn(), googleCallback: jest.fn(), githubCallback: jest.fn() })) }));
jest.mock('../../../src/modules/controllers/changePasswordController', () => ({ ChangePasswordController: jest.fn().mockImplementation(() => ({ changePassword: jest.fn(), adminChangePassword: jest.fn() })) }));

import { AuthController } from '../../../src/modules/controllers/authController';
import { ApiError } from '../../../src/utils/ApiError';

describe('AuthController', () => {
  let controller: AuthController;
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    controller = new AuthController();
    req = { body: {}, user: { id: 'user-id' } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();

    // Mock all sub-controller dependencies to prevent real service initialization
    controller['registerController'] = { register: jest.fn() } as any;
    controller['loginController'] = { login: jest.fn() } as any;
    controller['emailVerificationController'] = { verifyEmail: jest.fn() } as any;
    controller['phoneVerificationController'] = { verifyPhone: jest.fn() } as any;
    controller['forgotPasswordController'] = { forgotPassword: jest.fn() } as any;
    controller['resetPasswordController'] = { resetPassword: jest.fn() } as any;
    controller['resendOtpController'] = { resendOtp: jest.fn() } as any;
    controller['profileController'] = { getProfile: jest.fn(), updateProfile: jest.fn() } as any;
    controller['updateEmailController'] = { updateEmail: jest.fn(), confirmUpdateEmail: jest.fn() } as any;
    controller['updatePhoneController'] = { updatePhone: jest.fn(), confirmUpdatePhone: jest.fn() } as any;
    controller['twoFAController'] = {
      setup2FA: jest.fn(),
      verify2FASetup: jest.fn(),
      disable2FA: jest.fn(),
      get2FAQRCode: jest.fn()
    } as any;
    controller['socialLoginController'] = {
      socialLogin: jest.fn(),
      getGoogleAuthUrl: jest.fn(),
      getGitHubAuthUrl: jest.fn(),
      googleCallback: jest.fn(),
      githubCallback: jest.fn()
    } as any;
    controller['changePasswordController'] = {
      changePassword: jest.fn(),
      adminChangePassword: jest.fn()
    } as any;
  });

  it('should delegate register to RegisterController', async () => {
    controller['registerController'].register = jest.fn().mockResolvedValue('ok');
    await controller.register(req, res, next);
    expect(controller['registerController'].register).toHaveBeenCalled();
  });

  it('should delegate login to LoginController', async () => {
    controller['loginController'].login = jest.fn().mockResolvedValue('ok');
    await controller.login(req, res, next);
    expect(controller['loginController'].login).toHaveBeenCalled();
  });

  it('should delegate verifyEmail to EmailVerificationController', async () => {
    controller['emailVerificationController'].verifyEmail = jest.fn().mockResolvedValue('ok');
    await controller.verifyEmail(req, res, next);
    expect(controller['emailVerificationController'].verifyEmail).toHaveBeenCalled();
  });

  it('should delegate verifyPhone to PhoneVerificationController', async () => {
    controller['phoneVerificationController'].verifyPhone = jest.fn().mockResolvedValue('ok');
    await controller.verifyPhone(req, res, next);
    expect(controller['phoneVerificationController'].verifyPhone).toHaveBeenCalled();
  });

  it('should delegate forgotPassword to ForgotPasswordController', async () => {
    controller['forgotPasswordController'].forgotPassword = jest.fn().mockResolvedValue('ok');
    await controller.forgotPassword(req, res, next);
    expect(controller['forgotPasswordController'].forgotPassword).toHaveBeenCalled();
  });

  it('should delegate resetPassword to ResetPasswordController', async () => {
    controller['resetPasswordController'].resetPassword = jest.fn().mockResolvedValue('ok');
    await controller.resetPassword(req, res, next);
    expect(controller['resetPasswordController'].resetPassword).toHaveBeenCalled();
  });

  it('should delegate resendOtp to ResendOtpController', async () => {
    controller['resendOtpController'].resendOtp = jest.fn().mockResolvedValue('ok');
    await controller.resendOtp(req, res, next);
    expect(controller['resendOtpController'].resendOtp).toHaveBeenCalled();
  });

  it('should delegate getProfile to ProfileController', async () => {
    controller['profileController'].getProfile = jest.fn().mockResolvedValue('ok');
    await controller.getProfile(req, res, next);
    expect(controller['profileController'].getProfile).toHaveBeenCalled();
  });

  it('should delegate updateProfile to ProfileController', async () => {
    controller['profileController'].updateProfile = jest.fn().mockResolvedValue('ok');
    await controller.updateProfile(req, res, next);
    expect(controller['profileController'].updateProfile).toHaveBeenCalled();
  });

  it('should delegate updateEmail to UpdateEmailController', async () => {
    controller['updateEmailController'].updateEmail = jest.fn().mockResolvedValue('ok');
    await controller.updateEmail(req, res, next);
    expect(controller['updateEmailController'].updateEmail).toHaveBeenCalled();
  });

  it('should delegate confirmEmailUpdate to UpdateEmailController', async () => {
    controller['updateEmailController'].confirmUpdateEmail = jest.fn().mockResolvedValue('ok');
    await controller.confirmEmailUpdate(req, res, next);
    expect(controller['updateEmailController'].confirmUpdateEmail).toHaveBeenCalled();
  });

  it('should delegate updatePhone to UpdatePhoneController', async () => {
    controller['updatePhoneController'].updatePhone = jest.fn().mockResolvedValue('ok');
    await controller.updatePhone(req, res, next);
    expect(controller['updatePhoneController'].updatePhone).toHaveBeenCalled();
  });

  it('should delegate confirmPhoneUpdate to UpdatePhoneController', async () => {
    controller['updatePhoneController'].confirmUpdatePhone = jest.fn().mockResolvedValue('ok');
    await controller.confirmPhoneUpdate(req, res, next);
    expect(controller['updatePhoneController'].confirmUpdatePhone).toHaveBeenCalled();
  });

  it('should delegate setup2FA to TwoFAController', async () => {
    controller['twoFAController'].setup2FA = jest.fn().mockResolvedValue('ok');
    await controller.setup2FA(req, res, next);
    expect(controller['twoFAController'].setup2FA).toHaveBeenCalled();
  });

  it('should delegate verify2FASetup to TwoFAController', async () => {
    controller['twoFAController'].verify2FASetup = jest.fn().mockResolvedValue('ok');
    await controller.verify2FASetup(req, res, next);
    expect(controller['twoFAController'].verify2FASetup).toHaveBeenCalled();
  });

  it('should delegate disable2FA to TwoFAController', async () => {
    controller['twoFAController'].disable2FA = jest.fn().mockResolvedValue('ok');
    await controller.disable2FA(req, res, next);
    expect(controller['twoFAController'].disable2FA).toHaveBeenCalled();
  });

  it('should delegate get2FAQRCode to TwoFAController', async () => {
    controller['twoFAController'].get2FAQRCode = jest.fn().mockResolvedValue('ok');
    await controller.get2FAQRCode(req, res, next);
    expect(controller['twoFAController'].get2FAQRCode).toHaveBeenCalled();
  });

  it('should delegate socialLogin to SocialLoginController', async () => {
    controller['socialLoginController'].socialLogin = jest.fn().mockResolvedValue('ok');
    await controller.socialLogin(req, res, next);
    expect(controller['socialLoginController'].socialLogin).toHaveBeenCalled();
  });

  it('should delegate getGoogleAuthUrl to SocialLoginController', async () => {
    controller['socialLoginController'].getGoogleAuthUrl = jest.fn().mockResolvedValue('ok');
    await controller.getGoogleAuthUrl(req, res, next);
    expect(controller['socialLoginController'].getGoogleAuthUrl).toHaveBeenCalled();
  });

  it('should delegate getGitHubAuthUrl to SocialLoginController', async () => {
    controller['socialLoginController'].getGitHubAuthUrl = jest.fn().mockResolvedValue('ok');
    await controller.getGitHubAuthUrl(req, res, next);
    expect(controller['socialLoginController'].getGitHubAuthUrl).toHaveBeenCalled();
  });

  it('should delegate googleCallback to SocialLoginController', async () => {
    controller['socialLoginController'].googleCallback = jest.fn().mockResolvedValue('ok');
    await controller.googleCallback(req, res, next);
    expect(controller['socialLoginController'].googleCallback).toHaveBeenCalled();
  });

  it('should delegate githubCallback to SocialLoginController', async () => {
    controller['socialLoginController'].githubCallback = jest.fn().mockResolvedValue('ok');
    await controller.githubCallback(req, res, next);
    expect(controller['socialLoginController'].githubCallback).toHaveBeenCalled();
  });

  // Removed tests for linkSocialAccount and unlinkSocialAccount as these are not delegated by AuthController

  it('should delegate changePassword to ChangePasswordController', async () => {
    controller['changePasswordController'].changePassword = jest.fn().mockResolvedValue('ok');
    await controller.changePassword(req, res, next);
    expect(controller['changePasswordController'].changePassword).toHaveBeenCalled();
  });

  it('should delegate adminChangePassword to ChangePasswordController', async () => {
    controller['changePasswordController'].adminChangePassword = jest.fn().mockResolvedValue('ok');
    await controller.adminChangePassword(req, res, next);
    expect(controller['changePasswordController'].adminChangePassword).toHaveBeenCalled();
  });
});
