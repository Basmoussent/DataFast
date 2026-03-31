import type { CreateCheckoutRequest, CheckoutEntity } from "creem/models/components";

// ─── Config ────────────────────────────────────────────────────────────────

export interface CreemDataFastConfig {
  /** CREEM API key */
  creemApiKey: string;
  /** DataFast API key */
  datafastApiKey: string;
  /** CREEM webhook secret for signature verification */
  webhookSecret: string;
  /**
   * DataFast API base URL.
   * @default "https://api.datafast.io"
   */
  datafastApiUrl?: string;
  /**
   * Use CREEM test environment.
   * @default false
   */
  testMode?: boolean;
  /**
   * Custom logger. Defaults to `console.warn` for warnings.
   * Pass your own logger (e.g. Pino, Winston) to integrate with your logging stack.
   */
  logger?: { warn: (msg: string) => void };
}

// ─── Checkout ──────────────────────────────────────────────────────────────

/** Params for createCheckout — same as CREEM's CreateCheckoutRequest */
export type CreateCheckoutParams = CreateCheckoutRequest;

/** Result returned by createCheckout */
export interface CheckoutResult {
  /** Redirect customers to this URL */
  checkoutUrl: string;
  /** The full CREEM checkout entity */
  checkout: CheckoutEntity;
  /** Whether a DataFast visitor ID was captured and injected */
  visitorIdCaptured: boolean;
}

// ─── DataFast API ──────────────────────────────────────────────────────────

export type DataFastEventType = "purchase" | "subscription_renewal" | "subscription_start" | "subscription_trial";

export interface DataFastConversionPayload {
  visitor_id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  event_type: DataFastEventType;
  product_name?: string;
  subscription_id?: string;
}

export interface DataFastConversionResult {
  success: boolean;
  conversionId?: string;
  error?: string;
}

// ─── Webhooks ──────────────────────────────────────────────────────────────

export type CreemEventType =
  | "checkout.completed"
  | "subscription.paid"
  | "subscription.active"
  | "subscription.canceled"
  | "subscription.expired"
  | "subscription.paused"
  | "subscription.trialing"
  | "subscription.update"
  | "subscription.scheduled_cancel"
  | "refund.created"
  | "dispute.created";

export interface CreemWebhookEvent {
  id: string;
  eventType: CreemEventType;
  created_at: number;
  object: CreemCheckoutCompletedObject | CreemSubscriptionObject | Record<string, unknown>;
}

export interface CreemOrderObject {
  id: string;
  total_amount: number;
  currency: string;
  status: string;
}

export interface CreemProductObject {
  id: string;
  name: string;
  price: number;
  currency: string;
}

export interface CreemCustomerObject {
  id: string;
  email: string;
}

export interface CreemCheckoutCompletedObject {
  id: string;
  status: string;
  order: CreemOrderObject;
  product: CreemProductObject;
  customer: CreemCustomerObject;
  subscription?: { id: string };
  metadata?: Record<string, unknown>;
}

export interface CreemSubscriptionObject {
  id: string;
  status: string;
  product: CreemProductObject;
  customer: CreemCustomerObject;
  last_transaction?: CreemOrderObject;
  metadata?: Record<string, unknown>;
}

/** Context passed to webhook handlers */
export interface WebhookHandlerContext {
  event: CreemWebhookEvent;
  /** True if a DataFast conversion was successfully tracked */
  conversionTracked: boolean;
  /** The visitor ID extracted from metadata (if present) */
  visitorId: string | undefined;
}

export interface WebhookHandlers {
  /**
   * Called after checkout.completed — DataFast attribution already tracked.
   * Override to add custom business logic (e.g. provision user access).
   */
  onCheckoutCompleted?: (
    object: CreemCheckoutCompletedObject,
    ctx: WebhookHandlerContext
  ) => Promise<void> | void;
  /**
   * Called after subscription.paid — DataFast attribution already tracked.
   */
  onSubscriptionPaid?: (
    object: CreemSubscriptionObject,
    ctx: WebhookHandlerContext
  ) => Promise<void> | void;
  /**
   * Called after subscription.active (new subscription first payment) —
   * DataFast attribution already tracked as "subscription_start".
   */
  onSubscriptionActive?: (
    object: CreemSubscriptionObject,
    ctx: WebhookHandlerContext
  ) => Promise<void> | void;
  /**
   * Called after subscription.trialing (trial started, no payment yet).
   * DataFast is not called since there is no revenue to attribute.
   */
  onSubscriptionTrialing?: (
    object: CreemSubscriptionObject,
    ctx: WebhookHandlerContext
  ) => Promise<void> | void;
  /** Called for any event type not handled above */
  onOtherEvent?: (
    event: CreemWebhookEvent,
    ctx: Pick<WebhookHandlerContext, "event">
  ) => Promise<void> | void;
}

// ─── Cookie / client-side ──────────────────────────────────────────────────

export const DATAFAST_COOKIE_NAME = "datafast_visitor_id" as const;
export const DATAFAST_METADATA_KEY = "datafast_visitor_id" as const;
