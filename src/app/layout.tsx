import type { Metadata, Viewport } from 'next';
import { copy } from '@/copy/en';
import './globals.css';

export const metadata: Metadata = {
  title: copy.brand,
  description: copy.tagline,
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
