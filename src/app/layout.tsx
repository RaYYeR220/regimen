import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Regimen',
  description:
    'Statistical validation desk for OlaXBT Nexus trading strategies: is the track record distinguishable from luck, and in which market regimes does it hold?',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
