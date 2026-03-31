import { createNextJsWebhookHandler } from "creem-datafast/adapters/nextjs";

/**
 * CREEM webhook handler — automatically tracks revenue attribution in DataFast
 * for checkout.completed and subscription.paid events.
 *
 * Register this URL in your CREEM dashboard under Developers > Webhooks:
 *   https://your-domain.com/api/webhooks/creem
 */
export const POST = createNextJsWebhookHandler(
  {
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,
  },
  {
    onCheckoutCompleted: async (object, ctx) => {
      console.log(
        `[webhook] New purchase: ${object.customer.email} bought ${object.product.name}`,
        `(DataFast visitor: ${ctx.visitorId ?? "unknown"}, tracked: ${ctx.conversionTracked})`
      );

      // Add your business logic here:
      // - Provision user access
      // - Send welcome email
      // - Create account in your database
    },

    onSubscriptionPaid: async (object, ctx) => {
      console.log(
        `[webhook] Subscription renewal: ${object.customer.email} — ${object.product.name}`,
        `(DataFast tracked: ${ctx.conversionTracked})`
      );

      // Add your renewal logic here:
      // - Extend access period
      // - Update subscription status in DB
    },

    onOtherEvent: async (event) => {
      console.log(`[webhook] Received event: ${event.eventType}`);
    },
  }
);
