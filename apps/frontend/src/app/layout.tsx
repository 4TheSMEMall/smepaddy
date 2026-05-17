import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SME Paddy",
  description: "Your Business Companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
