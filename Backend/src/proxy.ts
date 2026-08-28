import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refresca el token de sesión en cada petición.
 *
 * En Next.js 16 esto se llama `proxy` (antes era `middleware`).
 *
 * Los tokens de Supabase duran una hora. Sin esto, a la persona de recepción
 * se le cerraría la sesión a media jornada. Los Server Components no pueden
 * escribir cookies, así que el refresco tiene que pasar aquí.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida el token contra Supabase. No usar getSession() aquí:
  // ese lee la cookie sin verificarla, así que un token falsificado pasaría.
  const { data: { user } } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;

  // Sin sesión: es desde ahí desde donde se hace el login. Cada ruta se apaga sola en producción.
  const esDocumentacion = ruta === '/docs' || ruta === '/api/openapi';

  const esPublica =
    esDocumentacion ||
    ruta.startsWith('/login') ||
    ruta.startsWith('/api/auth') || // sin esto no habría forma de entrar: el login daría 401
    ruta.startsWith('/api/salud') ||
    ruta.startsWith('/_next') ||
    ruta === '/favicon.ico' ||
    // Página de estado. El backend no tiene login propio: la UI vive en `Frontend/`.
    ruta === '/';

  if (!user && !esPublica) {
    if (ruta.startsWith('/api/')) {
      return NextResponse.json(
        { ok: false, error: 'Necesitas iniciar sesión.' },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
