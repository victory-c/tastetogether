import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "TasteTogether — two tastes, one table",
  description:
    "Tell us the music, films and shows you each love. TasteTogether's agent reads both tastes through Qloo's cultural graph and finds the restaurant you'll both love.",
  openGraph: {
    title: "TasteTogether — two tastes, one table",
    description: "An AI dining agent that finds where two people's tastes meet, powered by Qloo's taste graph.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf6ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="relative min-h-full">
        <div className="relative z-10 flex min-h-full flex-col">{children}</div>
      </body>
    </html>
  );
}
