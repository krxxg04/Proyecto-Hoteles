import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hostal Inteligente · Backend',
  description: 'API y lógica de servidor del sistema de gestión de hostales',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
