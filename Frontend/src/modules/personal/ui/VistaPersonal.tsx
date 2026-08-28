'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import type { Perfil } from '../domain/tipos';
import { crearPersona, desactivarPersona } from '../infrastructure/acciones';
import { ROLES, ETIQUETA_ROL, type Rol } from '@/shared/dominio/tipos';
import { Boton, Campo, Chip, ErrorCaja, Pildora } from '@/shared/ui/primitivos';
import { Celda, EncabezadoSeccion, Fila, Tabla } from '@/shared/ui/tabla';

/** Registro del equipo. El PIN nunca se lee: se reemplaza. */
export function VistaPersonal({ personal }: { personal: Perfil[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  function darDeBaja(p: Perfil) {
    setError(null);
    empezar(async () => {
      const r = await desactivarPersona(p.id);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoSeccion
        titulo="Personal"
        subtitulo="Quién trabaja en el hostal y con qué permisos"
        accion={
          <Boton variante="primario" onClick={() => setCreando(true)}>
            <Plus className="size-4" />
            Nueva persona
          </Boton>
        }
      />

      {error && <ErrorCaja mensaje={error} />}

      <Tabla columnas={['Estado', 'Nombre', 'DNI', 'Rol', 'Teléfono', '']}>
        {personal.map((p) => (
          <Fila key={p.id}>
            <Celda>
              {p.activo ? <Chip tono="success">Activo</Chip> : <Chip tono="muted">Inactivo</Chip>}
            </Celda>
            <Celda className="font-medium">{p.nombre}</Celda>
            <Celda className="tabular-nums text-tx-sec">{p.dni}</Celda>
            <Celda>
              <Chip tono="brand">{ETIQUETA_ROL[p.rol]}</Chip>
            </Celda>
            <Celda className="tabular-nums text-tx-sec" oculta="md">
              {p.telefono ?? '—'}
            </Celda>
            <Celda className="text-right">
              {p.activo && (
                <button
                  onClick={() => darDeBaja(p)}
                  disabled={ocupado}
                  aria-label={`Dar de baja a ${p.nombre}`}
                  className="grid size-8 cursor-pointer place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </Celda>
          </Fila>
        ))}
      </Tabla>

      <p className="text-[12px] text-tx-muted">
        Dar de baja no borra a nadie: hay turnos, ventas y auditoría firmados por esa persona.
      </p>

      {creando && (
        <DialogoPersona
          onCerrar={() => setCreando(false)}
          onHecho={() => {
            setCreando(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function DialogoPersona({ onCerrar, onHecho }: { onCerrar: () => void; onHecho: () => void }) {
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('recepcion');
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [campo, setCampo] = useState<string | undefined>();
  const [enviando, empezar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    empezar(async () => {
      const r = await crearPersona({ dni, nombre, rol, telefono: telefono || undefined, pin });
      if (!r.ok) {
        setError(r.error);
        setCampo(r.campo);
        return;
      }
      onHecho();
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" onClick={onCerrar}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="pop w-full max-w-sm rounded-xl bg-surf-float p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[16px] font-semibold">Nueva persona</p>
            <p className="mt-0.5 text-[13px] text-tx-sec">Entrará con su DNI y este PIN</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-8 place-items-center rounded-md text-tx-muted hover:bg-surf-hover hover:text-tx cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Campo
            etiqueta="Nombre completo"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={campo === 'nombre' ? error ?? undefined : undefined}
          />
          <Campo
            etiqueta="DNI"
            inputMode="numeric"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            error={campo === 'dni' ? error ?? undefined : undefined}
          />

          <div>
            <span className="mb-1.5 block text-[12.5px] font-medium text-tx-sec">Rol</span>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <Pildora key={r} activa={rol === r} onClick={() => setRol(r)}>
                  {ETIQUETA_ROL[r]}
                </Pildora>
              ))}
            </div>
          </div>

          <Campo
            etiqueta="Teléfono (opcional)"
            inputMode="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
          <Campo
            etiqueta="PIN (6 dígitos)"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            error={campo === 'pin' ? error ?? undefined : undefined}
          />

          {error && !campo && <ErrorCaja mensaje={error} />}

          <div className="mt-1 flex gap-2">
            <Boton type="submit" variante="primario" disabled={enviando} className="flex-1">
              {enviando ? 'Creando…' : 'Crear'}
            </Boton>
            <Boton type="button" variante="fantasma" onClick={onCerrar}>
              Cancelar
            </Boton>
          </div>
        </div>
      </form>
    </div>
  );
}
