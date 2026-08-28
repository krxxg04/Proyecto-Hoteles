import { docsHabilitados } from '@/shared/docs/habilitado';

/** Página de estado. El backend no tiene interfaz: la UI vive en `Frontend/`. */
export default function Inicio() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
        margin: '48px auto',
        padding: '0 24px',
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ marginBottom: 4 }}>Hostal Inteligente · Backend</h1>
      <p style={{ color: '#666', marginTop: 0 }}>API y lógica de servidor. La interfaz está en `Frontend/`.</p>

      {docsHabilitados() && (
        <p>
          <a href="/docs" style={{ fontWeight: 600 }}>
            Documentación interactiva (Swagger)
          </a>{' '}
          · especificación en <code>/api/openapi</code>
        </p>
      )}
    </main>
  );
}
