import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Devanagari, Yatra_One, Rozha_One } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import './immersive.css';
import './ethereal.css';
import { GlobalAudioProvider } from '@/contexts/GlobalAudioContext';
import GlobalPlayerWrapper from '@/components/GlobalPlayerWrapper';

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
  other: {
    google: 'notranslate',
    'mobile-web-app-capable': 'yes',
  },
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
    capable: true,
    title: 'Deluxe Mix',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#050505',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" className={`${GeistSans.variable} ${notoSansDevanagari.variable} ${yatraOne.variable} ${rozhaOne.variable}`}>
      <body className="notranslate bg-black font-sans antialiased text-white">
        <div className="ethereal-ambient-bg" />
        <GlobalAudioProvider>
          {children}
          <GlobalPlayerWrapper />
        </GlobalAudioProvider>
      </body>
    </html>
  );
}

