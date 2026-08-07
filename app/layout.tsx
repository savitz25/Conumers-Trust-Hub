import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { ClickTracker } from '@/components/analytics/click-tracker';
import { AskChatShell } from '@/components/ask-chat/ask-chat-shell';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { rootLayoutMetadata } from '@/lib/seo/metadata';
import { ASK_NETWORK_STANDARD_VERSION } from '@/lib/network/standard-version';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

export const metadata: Metadata = rootLayoutMetadata;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased`}
        data-hub="ask"
        data-network-standard={ASK_NETWORK_STANDARD_VERSION}
      >
        {/* network-standard: {ASK_NETWORK_STANDARD_VERSION} */}
        <AskChatShell>
          <ClickTracker />
          <Navbar />
          <main className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC]">{children}</main>
          <Footer />
        </AskChatShell>
        <Analytics />
      </body>
    </html>
  );
}
