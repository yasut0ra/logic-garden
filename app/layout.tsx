import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Logic Garden — Contextual Circuit Search',
  description:
    'Can a contextual bandit learn how to build a logic circuit? Inspect features, LinUCB decisions, actual rewards, and reproducible search experiments.',
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
