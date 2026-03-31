interface Props {
  searchParams: Promise<{
    checkout_id?: string;
    order_id?: string;
    customer_id?: string;
    subscription_id?: string;
    product_id?: string;
  }>;
}

export default async function SuccessPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <main>
      <div style={{
        textAlign: "center",
        padding: "3rem 1rem",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✓</div>
        <h1>Payment successful!</h1>
        <p style={{ color: "#64748b" }}>
          Welcome to Pro. Your subscription is now active.
        </p>

        {params.subscription_id && (
          <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
            Subscription: {params.subscription_id}
          </p>
        )}

        <p style={{
          marginTop: "2rem",
          padding: "1rem",
          background: "#f0fdf4",
          borderRadius: 8,
          color: "#16a34a",
          fontSize: "0.875rem",
        }}>
          Revenue attribution has been recorded in DataFast.
          Visit your DataFast dashboard to see the traffic source that converted.
        </p>

        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: "2rem",
            padding: "0.75rem 2rem",
            background: "#2563eb",
            color: "white",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          Go to dashboard
        </a>
      </div>
    </main>
  );
}
