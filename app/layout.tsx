import type { Metadata } from "next";
import "./globals.css";
import { AppLayoutWrapper } from "../components/AppLayoutWrapper";

export const metadata: Metadata = {
  metadataBase: new URL("https://veil-omega-nine.vercel.app"),
  title: "Veil Protocol — Private Swaps on Uniswap v4",
  description:
    "Zero-knowledge privacy layer for Uniswap v4 on Robinhood Chain. Non-custodial shielded pools, association sets, and autonomous protocol fee buyback & burn.",
  openGraph: {
    title: "Veil Protocol — Private Swaps on Uniswap v4",
    description:
      "Zero-knowledge privacy layer for Uniswap v4 on Robinhood Chain. Non-custodial shielded pools, association sets, and autonomous protocol fee buyback & burn.",
    url: "https://veil-omega-nine.vercel.app",
    siteName: "Veil Protocol",
    images: [
      {
        url: "/veil-logo.png",
        width: 1200,
        height: 630,
        alt: "Veil Protocol",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Veil Protocol — Private Swaps on Uniswap v4",
    description:
      "Zero-knowledge privacy layer for Uniswap v4 on Robinhood Chain. Non-custodial shielded pools, association sets, and autonomous protocol fee buyback & burn.",
    images: ["/veil-logo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/veil-logo.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="lp-on">
      <body className="min-h-screen flex flex-col antialiased relative overflow-x-hidden" style={{ color: "var(--color-text)" }}>
        <AppLayoutWrapper>{children}</AppLayoutWrapper>
      </body>
    </html>
  );
}
