import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Devanagari, Yatra_One, Rozha_One } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari', 'latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-devanagari',
  display: 'swap',
});

const yatraOne = Yatra_One({
  subsets: ['devanagari', 'latin'],
  weight: ['400'],
  variable: '--font-yatra',
  display: 'swap',
});

const rozhaOne = Rozha_One({
  subsets: ['devanagari', 'latin'],
  weight: ['400'],
  variable: '--font-rozha',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'इश्क़ के सुर - Deluxe Mix',
  description: 'इश्क़ के सुर - Deluxe Mix Music Player',
  keywords: ['इश्क़ के सुर', 'Deluxe Mix', 'Music Player', 'Sambalpuri Song', 'Odia Music'],
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    title: 'Deluxe Mix',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" className={`${inter.variable} ${notoSansDevanagari.variable} ${yatraOne.variable} ${rozhaOne.variable}`}>
      <body>{children}</body>
    </html>
  );
}
