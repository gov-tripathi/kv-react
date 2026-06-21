import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'KV Burhanpur · Arrangement',
  description: 'Teacher Arrangement & Substitution System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <head>
        <link rel="stylesheet" href="/heroui.css" />
      </head>
      <body className={jakarta.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
