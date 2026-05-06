import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import ScrollEffects from "@/components/scroll-effects";
import "./globals.css";

export const metadata: Metadata = {
  title: "KDUB Beats | Beats, Mixing & Mastering",
  description:
    "Shop beats and book mixing and mastering services for your next release with KDUB Beats.",
  icons: {
    icon: "/branding/logo.png",
    shortcut: "/branding/logo.png",
    apple: "/branding/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9889333502930604"
          crossOrigin="anonymous"></script>
      </head>
      <body>
        <ScrollEffects />
        {children}
        <Analytics />
      </body>
    </html>
  );
}