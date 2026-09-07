import { useRef, type KeyboardEvent } from 'react';

/**
 * Permiso de una tool, estilo "semáforo": tres estados mutuamente excluyentes que
 * iluminan SOLO el seleccionado (rojo = denegar, amarillo = preguntar, verde =
 * permitir). Es un radiogroup accesible (teclado + aria-checked), reutilizable
 * para los permisos de las tools de cualquier MCP.
 */
export type ToolPermission = 'prohibited' | 'ask' | 'auto';

const ORDER: ToolPermission[] = ['prohibited', 'ask', 'auto'];

const META: Record<
  ToolPermission,
  { label: string; help: string; activeClass: string }
> = {
  prohibited: { label: 'Prohibido', help: 'Denegar — no la ofrece', activeClass: 'bg-red-500 text-white' },
  ask: { label: 'Consulta', help: 'Preguntar antes de usarla', activeClass: 'bg-yellow-400 text-neutral-900' },
  auto: { label: 'Automático', help: 'Permitir siempre', activeClass: 'bg-emerald-500 text-white' },
};

/** Glifo (decorativo) de cada estado: ✕ / ? / ✓. */
function Glyph({ kind }: { kind: ToolPermission }) {
  if (kind === 'prohibited') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'auto') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <span className="text-[15px] font-bold leading-none" aria-hidden="true">
      ?
    </span>
  );
}

export const ToolPermissionToggle = ({
  value,
  onChange,
  label,
}: {
  value: ToolPermission;
  onChange: (v: ToolPermission) => void;
  /** Nombre de la tool, para que el lector de pantalla anuncie qué se está controlando. */
  label?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Mueve la selección con flechas (radiogroup) y lleva el foco al nuevo estado.
  const move = (next: ToolPermission) => {
    onChange(next);
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button');
    buttons?.[ORDER.indexOf(next)]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ORDER.indexOf(value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      move(ORDER[Math.min(ORDER.length - 1, i + 1)]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(ORDER[Math.max(0, i - 1)]);
    }
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label ? `Permiso de ${label}` : 'Permiso de la herramienta'}
      onKeyDown={onKeyDown}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-ui-border-base bg-ui-bg-subtle p-0.5"
    >
      {ORDER.map((opt) => {
        const selected = value === opt;
        const meta = META[opt];
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={meta.label}
            title={`${meta.label} — ${meta.help}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt)}
            className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${
              selected ? meta.activeClass : 'text-ui-fg-muted hover:bg-ui-bg-base hover:text-ui-fg-subtle'
            }`}
          >
            <Glyph kind={opt} />
          </button>
        );
      })}
    </div>
  );
};
