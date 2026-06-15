import type { Metadata } from "next";
import { Outfit } from "next/font/google";
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
  return (
    <html lang="en" className={`${outfit.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
