// Root layout — viewport config, fonts, and global styles.
// Homemade Apple is loaded here and exposed as a CSS variable for use in the wordmark.

import type { Metadata, Viewport } from 'next';
import { Homemade_Apple } from 'next/font/google';
import './globals.css';

const homemadeApple = Homemade_Apple({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-homemade-apple',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Eat to Live',
  description: 'Personal nutrition journal',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={homemadeApple.variable}>
      <body className="antialiased min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        {children}
      </body>
    </html>
  );
}
