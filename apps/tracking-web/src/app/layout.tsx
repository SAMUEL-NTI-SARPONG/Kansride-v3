import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Track Your Ride - KansRide',
  description: 'Track your KansRide trip in real-time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
