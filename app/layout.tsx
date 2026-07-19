import type { Metadata } from 'next';
import { Lexend } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-lexend',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KV Burhanpur · Arrangement',
  description: 'Teacher Arrangement & Substitution System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lexend.variable}>
      <head>
        <link rel="stylesheet" href="/heroui.css" />
      </head>
      <body className={lexend.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
