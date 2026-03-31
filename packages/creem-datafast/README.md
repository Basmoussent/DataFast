# @0xentropy/creem-datafast

Wraps the [CREEM](https://creem.io) SDK to automatically attribute revenue to DataFast visitor sessions — no glue code.

**Flow:** DataFast script sets a cookie → your checkout route injects it into CREEM metadata → webhook forwards the conversion to DataFast.

## Install

```bash
npm install @0xentropy/creem-datafast creem
```

## Next.js

`app/api/checkout/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { CreemDataFast } from "@0xentropy/creem-datafast";

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

`app/api/webhooks/creem/route.ts`

```typescript
import { createNextJsWebhookHandler } from "@0xentropy/creem-datafast/adapters/nextjs";

export const POST = createNextJsWebhookHandler(
  {
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
    datafastApiKey: process.env.DATAFAST_API_KEY!,
  },
  {
    onCheckoutCompleted: async (object, ctx) => {
      // attribution already tracked — provision access here
    },
  }
);
```

`app/layout.tsx` — add the DataFast tracking script:

```tsx
<script
  defer
  data-website-id={process.env.NEXT_PUBLIC_DATAFAST_SITE_ID}
  data-domain={process.env.NEXT_PUBLIC_DATAFAST_DOMAIN}
  src="https://datafa.st/js/script.js"
/>
```

Register your webhook URL in the CREEM dashboard: `https://your-domain.com/api/webhooks/creem`

## Express

```typescript
import { CreemDataFast } from "@0xentropy/creem-datafast";
import { createExpressWebhookHandler } from "@0xentropy/creem-datafast/adapters/express";

const client = new CreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  appUrl: process.env.APP_URL,
});

app.post("/api/checkout", async (req, res) => {
  const { checkoutUrl } = await client.createCheckout(
    { productId: "prod_xxx" },
    { cookies: req.headers.cookie }
  );
  res.json({ checkoutUrl });
});

// Raw body required before this route
app.use("/webhooks/creem", express.raw({ type: "application/json" }));
app.post("/webhooks/creem", createExpressWebhookHandler(
  { webhookSecret: process.env.CREEM_WEBHOOK_SECRET!, datafastApiKey: process.env.DATAFAST_API_KEY! },
  { onCheckoutCompleted: async (object, ctx) => { /* ... */ } }
));
```

## Other frameworks

```typescript
const { ok, error } = await client.handleWebhook(rawBody, signature, {
  onCheckoutCompleted: async (object, ctx) => { /* ... */ },
});
```

## Visitor ID via query param

If cookies aren't available, pass the visitor ID via URL instead:

```typescript
// Browser
import { appendVisitorIdToCheckoutUrl } from "@0xentropy/creem-datafast/browser";
window.location.href = appendVisitorIdToCheckoutUrl(checkoutUrl);

// Server — reads ?datafast_visitor_id=... as fallback
await client.createCheckout(params, { searchParams: req.nextUrl.searchParams });
```

## Configuration

| Option | Required | Description |
|--------|----------|-------------|
| `creemApiKey` | ✓ | CREEM API key (`creem_test_…` or `creem_…`) |
| `datafastApiKey` | ✓ | DataFast API key |
| `webhookSecret` | ✓ | Webhook signing secret from CREEM dashboard |
| `appUrl` | | Base URL — sets default success redirect to `${appUrl}/success` |
| `testMode` | | Use CREEM sandbox (default: `false`) |
| `datafastApiUrl` | | Override DataFast base URL |
| `logger` | | Custom logger `{ warn }` (default: `console.warn`) |

## Webhook events

| CREEM event | DataFast `event_type` |
|-------------|----------------------|
| `checkout.completed` | `purchase` |
| `subscription.active` | `subscription_start` |
| `subscription.paid` | `subscription_renewal` |
| `subscription.trialing` | _(no conversion — no revenue yet)_ |

Attribution is skipped silently when `datafast_visitor_id` is absent from checkout metadata.

## Example app

```bash
cd example
cp .env.example .env.local
npm install && npm run dev
```

## License

MIT
