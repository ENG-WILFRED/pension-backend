import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
});

export const otpLoginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  otp: z.string().min(4, 'OTP is required'),
});

export const otpVerifySchema = otpLoginSchema.extend({
  newPassword: z.string().min(6).optional(),
});

export const setPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits').optional(),
});

export type LoginPayload = z.infer<typeof loginSchema>;
export type OtpVerifyPayload = z.infer<typeof otpVerifySchema>;
export type SetPasswordPayload = z.infer<typeof setPasswordSchema>;
