import { z } from 'zod';

export const purchaseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  planId: z.string().optional(),
  description: z.string().optional(),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;
