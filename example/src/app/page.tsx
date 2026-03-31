"use client";

import { useState } from "react";

export default function LandingPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string };

      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Failed to create checkout");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Acme SaaS</h1>
      <p>The best tool for your workflow. Powered by CREEM payments with DataFast attribution.</p>

      <div style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "2rem",
        maxWidth: 360,
        marginTop: "2rem",
      }}>
        <h2 style={{ marginTop: 0 }}>Pro Plan</h2>
        <p style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>
          $19.99<span style={{ fontSize: "1rem", fontWeight: "normal" }}>/mo</span>
        </p>
        <ul style={{ paddingLeft: "1.25rem", marginBottom: "1.5rem" }}>
          <li>Unlimited projects</li>
          <li>Priority support</li>
          <li>Advanced analytics</li>
          <li>API access</li>
        </ul>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem 1.5rem",
            background: loading ? "#94a3b8" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating checkout…" : "Subscribe now"}
        </button>
      </div>

      <p style={{ marginTop: "3rem", color: "#64748b", fontSize: "0.875rem" }}>
        Revenue attribution powered by{" "}
        <a href="https://datafast.io" target="_blank" rel="noopener noreferrer">
          DataFast
        </a>{" "}
        + payments by{" "}
        <a href="https://creem.io" target="_blank" rel="noopener noreferrer">
          CREEM
        </a>
      </p>
    </main>
  );
}
