import { Router, Request } from 'express';
import { AuthController } from '../controllers/authController';
import { validateRequest } from '../../middlewares/validation';
import { authLimiter, otpLimiter, passwordResetLimiter } from '../../middlewares/rateLimiter';
import { authenticateToken, requireEmailVerification, requirePhoneVerification } from '../../middlewares/auth';
import {
  registerSchema,
  loginSchema,
  emailVerificationSchema,
  phoneVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateEmailSchema,
  confirmUpdateEmailSchema,
  updatePhoneSchema,
  confirmUpdatePhoneSchema,
  updateProfileSchema,
  resendOtpSchema,
  setup2FASchema,
  verify2FASchema,
  socialLoginSchema,
  socialAuthCallbackSchema,
  changePasswordSchema,
  adminChangePasswordSchema
} from '../../validations/authValidations';

const router = Router();
const authController = new AuthController();

console.log('Debug: authRoutes initialized');

// Middleware to trace request paths
router.use((req, res, next) => {
  console.log(`Debug: Middleware executed for ${req.path}`);
  next();
});

// Public routes
router.post('/register', 
  authLimiter,
  validateRequest(registerSchema),
  authController.register
);

router.post('/login',
  authLimiter,
  validateRequest(loginSchema),
  authController.login
);

router.post('/social-login',
  authLimiter,
  validateRequest(socialLoginSchema),
  authController.socialLogin
);

// Social OAuth URLs
router.get('/google/auth-url',
  authController.getGoogleAuthUrl
);

router.get('/github/auth-url',
  authController.getGitHubAuthUrl
);

// Social OAuth callbacks
router.post('/google/callback',
  authLimiter,
  validateRequest(socialAuthCallbackSchema),
  authController.googleCallback
);

router.post('/github/callback',
  authLimiter,
  validateRequest(socialAuthCallbackSchema),
  authController.githubCallback
);

router.post('/forgot-password',
  passwordResetLimiter,
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);

router.post('/reset-password',
  passwordResetLimiter,
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

router.post('/verify-email',
  otpLimiter,
  validateRequest(emailVerificationSchema),
  authController.verifyEmail
);

router.post('/verify-phone',
  otpLimiter,
  validateRequest(phoneVerificationSchema),
  authController.verifyPhone
);

router.post('/resend-otp',
  otpLimiter,
  validateRequest(resendOtpSchema),
  authController.resendOtp
);

router.post('/refresh-token',
  authController.refreshToken
);

// Protected routes (require authentication)
router.use(authenticateToken);

router.get('/profile',
  authController.getProfile
);

router.put('/profile',
  validateRequest(updateProfileSchema),
  authController.updateProfile
);

router.post('/logout',
  authController.logout
);

router.post('/logout-all',
  authController.logoutAll
);

// Change password route
router.post('/change-password',
  validateRequest(changePasswordSchema),
  authController.changePassword
);

// Admin change password route (requires admin role)
router.post('/admin/change-password',
  validateRequest(adminChangePasswordSchema),
  authController.adminChangePassword
);

// Routes that require email verification
router.post('/update-email',
  requireEmailVerification,
  validateRequest(updateEmailSchema),
  authController.updateEmail
);

router.post('/confirm-email-update',
  requireEmailVerification,
  otpLimiter,
  validateRequest(confirmUpdateEmailSchema),
  authController.confirmEmailUpdate
);

// Routes that require phone verification
router.post('/update-phone',
  requirePhoneVerification,
  validateRequest(updatePhoneSchema),
  authController.updatePhone
);

router.post('/confirm-phone-update',
  requirePhoneVerification,
  otpLimiter,
  validateRequest(confirmUpdatePhoneSchema),
  authController.confirmPhoneUpdate
);

// 2FA routes (require full verification)
router.post('/setup-2fa',
  requireEmailVerification,
  requirePhoneVerification,
  validateRequest(setup2FASchema),
  authController.setup2FA
);

router.post('/verify-2fa-setup',
  requireEmailVerification,
  requirePhoneVerification,
  validateRequest(verify2FASchema),
  authController.verify2FASetup
);

router.post('/disable-2fa',
  requireEmailVerification,
  requirePhoneVerification,
  authController.disable2FA
);

router.get('/2fa-qr-code',
  requireEmailVerification,
  requirePhoneVerification,
  authController.get2FAQRCode
);

// Middleware validation route
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    fname: string;
    mname?: string;
    lname: string;
    email: string;
    isEmailVerified: boolean;
    countryCode: string;
    phone: string;
    isPhoneVerified: boolean;
    houseNumber: string;
    streetName: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    street: string;
    pincode: string;
    dob: Date;
    authType: string;
    is2FAEnabled: boolean;
    preferred2FAMethods: string;
    tokenVersion: number;
    loginAttempts: number;
    createdAt: Date;
    updatedAt: Date;
  };
}

router.get('/protected-route', (req: AuthenticatedRequest, res) => {
  console.log('Debug: /protected-route handler executed with user:', req.user);
  res.status(200).json({ message: 'Access granted' });
});

console.log('Debug: /protected-route registered');

export default router;
