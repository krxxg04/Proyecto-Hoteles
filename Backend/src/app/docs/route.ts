import { docsHabilitados } from '@/shared/docs/habilitado';

/** GET /docs -> Swagger UI. HTML plano: swagger-ui-react todavía choca con React 19. */

const CDN = 'https://unpkg.com/swagger-ui-dist@5';

const HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Hostal Inteligente · API</title>
  <link rel="stylesheet" href="${CDN}/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .aviso {
      font: 14px/1.5 system-ui, sans-serif;
      background: #fff7ed;
      border-bottom: 1px solid #fed7aa;
      color: #7c2d12;
      padding: 10px 20px;
    }
    .aviso strong { font-weight: 600; }
    .aviso code { background: #ffedd5; border-radius: 4px; padding: 1px 5px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="aviso">
    <strong>Entorno de pruebas.</strong>
    Entra con <code>POST /api/auth</code> y abre turno con <code>POST /api/turno</code>.
  </div>
  <div id="swagger-ui"></div>
  <script src="${CDN}/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/openapi',
      dom_id: '#swagger-ui',
      deepLinking: true,
      tryItOutEnabled: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 0,
      // Sin esto, "Try it out" saldría sin la cookie de sesión y todo daría 401.
      withCredentials: true,
      requestInterceptor: function (req) {
        req.credentials = 'same-origin';
        return req;
      },
    });
  </script>
</body>
</html>
`;

export async function GET() {
  if (!docsHabilitados()) return new Response('No disponible.', { status: 404 });

  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
