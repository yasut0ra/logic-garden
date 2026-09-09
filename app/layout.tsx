import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Logic Garden — Adaptive Circuit Laboratory',
  description:
    'Watch a multi-armed bandit grow a Boolean circuit. Explore mutation strategies, signals, and reproducible experiments.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
