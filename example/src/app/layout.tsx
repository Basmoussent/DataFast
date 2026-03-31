import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acme SaaS — Powered by CREEM + DataFast",
  description: "Example showing CREEM payments with DataFast revenue attribution",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          DataFast tracking script — replace YOUR_SITE_ID with your actual DataFast site ID.
          This script sets the `datafast_visitor_id` cookie that creem-datafast reads.
        */}
        <script
          defer
          data-website-id={process.env.NEXT_PUBLIC_DATAFAST_SITE_ID}
          data-domain={process.env.NEXT_PUBLIC_DATAFAST_DOMAIN}
          data-allow-localhost="true"
          src="https://datafa.st/js/script.js"
        />
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "0 auto", padding: "2rem" }}>
        {children}
      </body>
    </html>
  );
}
