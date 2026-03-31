import { z } from "zod";

// ─── Sub-objects ────────────────────────────────────────────────────────────

export const creemOrderObjectSchema = z.object({
  id: z.string(),
  total_amount: z.number(),
  currency: z.string(),
  status: z.string(),
});

export const creemProductObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  currency: z.string(),
});

export const creemCustomerObjectSchema = z.object({
  id: z.string(),
  email: z.string(),
});

// ─── Event objects ──────────────────────────────────────────────────────────

export const creemCheckoutCompletedObjectSchema = z.object({
  id: z.string(),
  status: z.string(),
  order: creemOrderObjectSchema,
  product: creemProductObjectSchema,
  customer: creemCustomerObjectSchema,
  subscription: z.object({ id: z.string() }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const creemSubscriptionObjectSchema = z.object({
  id: z.string(),
  status: z.string(),
  product: creemProductObjectSchema,
  customer: creemCustomerObjectSchema,
  last_transaction: creemOrderObjectSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── Event envelope ─────────────────────────────────────────────────────────

export const creemWebhookEventEnvelopeSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  created_at: z.number(),
  object: z.record(z.unknown()),
});

// ─── Inferred types (match the hand-written types in types.ts) ──────────────

export type ParsedCheckoutCompletedObject = z.infer<typeof creemCheckoutCompletedObjectSchema>;
export type ParsedSubscriptionObject = z.infer<typeof creemSubscriptionObjectSchema>;
export type ParsedWebhookEventEnvelope = z.infer<typeof creemWebhookEventEnvelopeSchema>;
