import { z } from 'zod';

const childSchema = z.object({
  name: z.string().optional(),
  dob: z.string().optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required for payment'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  spouseName: z.string().optional(),
  spouseDob: z.string().optional(),
  children: z.array(childSchema).optional(),
  nationalId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  salary: z.number().optional(),
  contributionRate: z.number().optional(),
  retirementAge: z.number().optional(),
  accountType: z.enum(['MANDATORY', 'VOLUNTARY', 'EMPLOYER', 'SAVINGS', 'WITHDRAWAL', 'BENEFITS']).default('MANDATORY').optional(),
  riskProfile: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM').optional(),
  currency: z.string().length(3, 'Currency code must be 3 chars').default('KES').optional(),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED', 'FROZEN', 'DECEASED']).default('ACTIVE').optional(),
  kycVerified: z.boolean().default(false).optional(),
  complianceStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).default('PENDING').optional(),
  pin: z.string().min(4, 'PIN must be at least 4 characters').max(4, 'PIN must be max 4 characters').optional(),
});

export type RegisterPayload = z.infer<typeof registerSchema>;
