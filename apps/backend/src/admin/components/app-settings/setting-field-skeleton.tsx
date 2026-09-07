import { Skeleton, TextSkeleton } from '../common/skeleton';

/**
 * Fila de esqueleto de UN ajuste, calcada de la forma real de `SettingField`
 * (label + badge + control).
 *
 * Sólo tapa lo que depende del fetch. El título de la card, el nombre de cada
 * grupo y el bloque "Sólo por entorno" NO llevan esqueleto: son estáticos —
 * vienen de los descriptores en `modules/app-settings/descriptors`, no de
 * `useAppSettings()` — así que mostrarlos de una es información real y no
 * relleno. Lo único que todavía no se sabe mientras `isPending` es el VALOR
 * efectivo de cada ajuste (origen, override, preview de secreto), que es
 * justo lo que tapa esta fila.
 */
export const SettingFieldSkeleton = () => (
  <div className="flex flex-col gap-y-1.5 py-3" aria-hidden>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <TextSkeleton size="small" characters={14} />
      <Skeleton className="h-5 w-24 rounded-md" />
    </div>
    <Skeleton className="h-8 w-full max-w-sm rounded-md" />
  </div>
);
