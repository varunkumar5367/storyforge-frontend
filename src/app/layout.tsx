import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";
import MainLayout from "@/components/MainLayout";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "StoryForge AI — Automated Text-to-Video Engine",
  description: "Convert written stories (.txt) into complete YouTube-ready videos automatically. Generates AI illustrations, TTS voices, synced Whisper subtitles, and social metadata.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;
  const isAdsenseConfigured = adsenseId && adsenseId !== "pub-XXXXXXXXXXXXXXXX";

  return (
    <html lang="en" className={`${outfit.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        {isAdsenseConfigured && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
