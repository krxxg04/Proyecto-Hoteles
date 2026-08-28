import type { NextConfig } from 'next';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

/**
 * `/api/*` se reescribe al backend.
 *
 * Así el navegador solo habla con un origen: no hay CORS ni cookies entre dominios, y la
 * cookie de sesión que pone Supabase al entrar viaja como si fuera propia.
 */
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:ruta*', destination: `${BACKEND}/api/:ruta*` }];
  },
};

export default nextConfig;
