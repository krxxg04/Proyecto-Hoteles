import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { RegistroSW } from '@/shared/ui/RegistroSW';

/** Una sola familia, como manda Atlas. Next la auto-hospeda: sin petición a Google en runtime. */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Hostal Inteligente',
  description: 'Gestión de hostales con IA',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Hostal', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1E1E1E' },
    { media: '(prefers-color-scheme: light)', color: '#F5F5F5' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Antes de pintar, para que el tema claro no dé un flash oscuro. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tema');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <RegistroSW />
      </body>
    </html>
  );
}
