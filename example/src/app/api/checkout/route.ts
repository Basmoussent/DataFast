import { NextRequest, NextResponse } from "next/server";
import { CreemDataFast } from "creem-datafast";

const client = new CreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  testMode: process.env.NODE_ENV !== "production",
});

export async function POST(req: NextRequest) {
  try {
    const { checkoutUrl, visitorIdCaptured } = await client.createCheckout(
      {
        productId: process.env.CREEM_PRODUCT_ID!,
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
        metadata: {
          // Any additional metadata you want on the CREEM checkout.
          // datafast_visitor_id is automatically injected by the client.
        },
      },
      {
        // Pass the raw cookie header — the client extracts datafast_visitor_id
        cookies: req.headers.get("cookie") ?? undefined,
      }
    );

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[checkout] Created checkout. DataFast visitor captured: ${visitorIdCaptured}`
      );
    }

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[checkout] Failed to create checkout:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
