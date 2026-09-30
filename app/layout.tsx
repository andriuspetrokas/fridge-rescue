import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Fridge Rescue', description: 'Receptai iš to, ką turi šaldytuve' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="lt"><body>{children}</body></html>;
}
