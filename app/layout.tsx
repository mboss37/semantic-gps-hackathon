import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const SITE_URL = 'https://semantic-gps-hackathon.vercel.app';
const TITLE = 'Semantic GPS · Mission control for AI agents';
const DESCRIPTION =
  'The governance gateway between AI agents and the business systems they were never supposed to touch unsupervised. Live policies, saga rollback, audit on every call. Built with Opus 4.7.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · Semantic GPS',
  },
  description: DESCRIPTION,
  applicationName: 'Semantic GPS',
  authors: [{ name: 'Mihael Bosnjak', url: 'https://github.com/mboss37' }],
  creator: 'Mihael Bosnjak',
  publisher: 'Mihael Bosnjak',
  keywords: [
    'MCP',
    'Model Context Protocol',
    'AI agents',
    'agent governance',
    'control plane',
    'gateway',
    'observability',
    'audit',
    'saga rollback',
    'shadow enforce',
    'policy engine',
    'Anthropic',
    'Claude',
    'Opus 4.7',
    'Tool Relationship',
    'TRel',
    'agentic workflows',
    'Salesforce',
    'Slack',
    'GitHub',
  ],
  category: 'developer tools',
  openGraph: {
    type: 'website',
    siteName: 'Semantic GPS',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Semantic GPS, mission control for AI agents',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description:
      'Live policies, saga rollback, audit on every call. Built with Opus 4.7.',
    images: ['/opengraph-image'],
    creator: '@mboss37',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
