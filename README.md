# creem-datafast

> Connect CREEM payments to DataFast analytics automatically. Zero glue code.

**creem-datafast** is a TypeScript package that wraps the [CREEM](https://creem.io) SDK and automatically captures the DataFast visitor ID on checkout, forwarding payment events to DataFast for revenue attribution.

```
landing page (DataFast tracking) → checkout (visitor ID captured) → webhook (attribution sent)
```

## How it works

1. DataFast's tracking script sets a `datafast_visitor_id` cookie in the visitor's browser
2. When your server creates a CREEM checkout, `creem-datafast` reads that cookie and injects it into the checkout metadata
3. When CREEM fires a `checkout.completed` or `subscription.paid` webhook, the handler reads the visitor ID from metadata and sends a conversion event to DataFast

The merchant only needs to add two API keys — the package handles the rest.

## Quickstart

### Install

```bash
npm install creem-datafast creem
```

### Express

```typescript
import express from "express";
import { CreemDataFast } from "creem-datafast";
import { createExpressWebhookHandler } from "creem-datafast/adapters/express";

const app = express();

const client = new CreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
});

// Create checkout — reads datafast_visitor_id cookie automatically
app.post("/api/checkout", async (req, res) => {
  const { checkoutUrl } = await client.createCheckout(
    { productId: "prod_xxx", successUrl: "https://myapp.com/success" },
    { cookies: req.headers.cookie }
  );
  res.json({ checkoutUrl });
});

// Webhook — use raw body middleware before this route
app.use("/webhooks/creem", express.raw({ type: "application/json" }));

app.post(
  "/webhooks/creem",
  createExpressWebhookHandler(
    {
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
      datafastApiKey: process.env.DATAFAST_API_KEY!,
    },
    {
      onCheckoutCompleted: async (object, ctx) => {
        console.log("New sale!", object.customer.email, "visitor:", ctx.visitorId);
        // Provision user access here
      },
    }
  )
);
```

### Next.js (App Router)

**1. Checkout API route** — `app/api/checkout/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { CreemDataFast } from "creem-datafast";

const client = new CreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL, // success redirect → ${appUrl}/success
});

export async function POST(req: NextRequest) {
  const { checkoutUrl } = await client.createCheckout(
    { productId: process.env.CREEM_PRODUCT_ID! },
    { cookies: req.headers.get("cookie") ?? undefined }
  );
  return NextResponse.json({ checkoutUrl });
}
```

**2. Webhook handler** — `app/api/webhooks/creem/route.ts`

```typescript
import { createNextJsWebhookHandler } from "creem-datafast/adapters/nextjs";

export const POST = createNextJsWebhookHandler(
  {
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,
  },
  {
    onCheckoutCompleted: async (object, ctx) => {
      // DataFast attribution is already tracked at this point
      console.log("New purchase!", object.customer.email, "via", ctx.visitorId);
    },
  }
);
```

**3. Landing page** — add the DataFast tracking script to your layout:

```tsx
// app/layout.tsx
<script
  defer
  data-website-id={process.env.NEXT_PUBLIC_DATAFAST_SITE_ID}
  data-domain={process.env.NEXT_PUBLIC_DATAFAST_DOMAIN}
  src="https://datafa.st/js/script.js"
/>
```

**4. Register your webhook URL in the CREEM dashboard:**

```
https://your-domain.com/api/webhooks/creem
```

### Generic handler (any framework)

```typescript
import { CreemDataFast } from "creem-datafast";

const client = new CreemDataFast({ ... });

// In your request handler:
const rawBody = await req.text();
const signature = req.headers.get("creem-signature") ?? "";

const { ok, error } = await client.handleWebhook(rawBody, signature, {
  onCheckoutCompleted: async (object, ctx) => { /* ... */ },
});
```

### Client-side helper

```typescript
import { getDataFastVisitorId, appendVisitorIdToCheckoutUrl } from "creem-datafast/browser";

// Option A: Pass visitor ID to your checkout API (if you prefer URL params over cookies)
const checkoutUrl = appendVisitorIdToCheckoutUrl(serverGeneratedUrl);
window.location.href = checkoutUrl;

// Option B: Read it directly
const visitorId = getDataFastVisitorId(); // reads datafast_visitor_id cookie
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CREEM_API_KEY` | CREEM API key (test: `creem_test_…`, live: `creem_…`) |
| `CREEM_WEBHOOK_SECRET` | Webhook signing secret from CREEM dashboard |
| `DATAFAST_API_KEY` | DataFast API key |
| `CREEM_PRODUCT_ID` | Product ID to sell |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL (for success redirect) |

## Configuration

```typescript
new CreemDataFast({
  creemApiKey: string;       // Required: CREEM API key
  datafastApiKey: string;    // Required: DataFast API key
  webhookSecret: string;     // Required: CREEM webhook secret
  datafastApiUrl?: string;   // Optional: override DataFast base URL
  testMode?: boolean;        // Optional: use CREEM test environment (default: false)
})
```

## Webhook Events

| CREEM Event | DataFast event_type | Notes |
|-------------|--------------------|----|
| `checkout.completed` | `purchase` | One-time and first subscription payment |
| `subscription.paid` | `subscription_renewal` | Recurring billing cycle |

Attribution is only tracked when `datafast_visitor_id` is present in the checkout metadata. If missing, the webhook handler still runs but skips the DataFast call.

## DataFast Attribution Payload

```typescript
{
  visitor_id: string;          // from checkout metadata
  transaction_id: string;      // CREEM order ID
  amount: number;              // in cents (e.g. 1999 = $19.99)
  currency: string;            // e.g. "USD"
  event_type: "purchase" | "subscription_renewal";
  product_name?: string;
  subscription_id?: string;
}
```

## Example App

See [`/example`](./example) for a complete Next.js application demonstrating:

- Landing page with subscribe button
- Checkout API route that captures DataFast visitor ID
- Webhook handler that tracks attribution
- Success page

```bash
cd example
cp .env.example .env.local   # fill in your keys
npm install
npm run dev
```

## License

MIT
