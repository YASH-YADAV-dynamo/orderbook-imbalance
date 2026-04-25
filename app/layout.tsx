import type { Metadata, Viewport } from 'next';
import GlobalFooter from '@/components/GlobalFooter';
import './globals.css';

export const metadata: Metadata = {
  title: 'skewX | Orderbook Imbalance & Funding Arbitrage',
  description:
    'skewX provides real-time orderbook imbalance and funding arbitrage intelligence across major crypto exchanges.',
  keywords: [
    'skewX',
    'orderbook imbalance',
    'funding arbitrage',
    'crypto trading signals',
    'market microstructure',
  ],
  openGraph: {
    title: 'skewX | Orderbook Imbalance & Funding Arbitrage',
    description:
      'Real-time orderbook imbalance and funding arbitrage monitoring across major crypto venues.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'skewX | Orderbook Imbalance & Funding Arbitrage',
    description:
      'Track live imbalance and funding opportunities with skewX across crypto exchanges.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

import { Preloader } from '@/components/ui/Preloader';
import { GlobalFeedManager } from '@/components/GlobalFeedManager';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('obi-app');
                  if (theme) {
                    var parsed = JSON.parse(theme);
                    if (parsed && parsed.state && parsed.state.theme) {
                      document.documentElement.setAttribute('data-theme', parsed.state.theme);
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Preloader />
        <GlobalFeedManager />
        <div className="appRoot">
          <main className="appMain">{children}</main>
          <GlobalFooter />
        </div>
      </body>
    </html>
  );
}
