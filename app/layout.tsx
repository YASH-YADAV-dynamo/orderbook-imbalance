import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pacifica · Orderbook Imbalance',
  description: 'Real-time bid/ask pressure visualization',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
