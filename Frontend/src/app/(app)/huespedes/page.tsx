import { listarHuespedes } from '@/modules/huespedes/infrastructure/lecturas';
import { VistaHuespedes } from '@/modules/huespedes/ui/VistaHuespedes';
import { ErrorCaja } from '@/shared/ui/primitivos';
import { exigirSeccion } from '@/shared/ui/guardia';

export default async function Huespedes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await exigirSeccion('huespedes');

  const { q } = await searchParams;
  const r = await listarHuespedes(q);
  if (!r.ok) return <ErrorCaja mensaje={r.error} />;

  return <VistaHuespedes huespedes={r.datos} busqueda={q ?? ''} />;
}
