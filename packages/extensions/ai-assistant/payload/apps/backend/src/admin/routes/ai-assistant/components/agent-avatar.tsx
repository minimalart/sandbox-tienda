import { useMemo } from 'react';

/**
 * Avatar reutilizable de un agente. Dos modos:
 *  - `avatar_url` con valor (foto subida al bucket) → se muestra la imagen
 *    recortada en un círculo.
 *  - sin foto → iniciales del nombre sobre un color determinístico derivado de
 *    la `key` (estable entre renders y sesiones, y legible en claro/oscuro).
 *
 * El color sale de una paleta de tonos medios que contrastan con texto blanco
 * tanto en modo claro como oscuro.
 */

// Tonos medios de la paleta CDS: legibles con texto blanco en claro y oscuro.
const PALETTE = [
  '#1D9E75', // teal
  '#378ADD', // blue
  '#BA7517', // amber
  '#D85A30', // coral
  '#7F77DD', // purple
  '#D4537E', // pink
  '#639922', // green
  '#5F5E5A', // gray
] as const;

function hashKey(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

export function colorForKey(seed: string): string {
  return PALETTE[hashKey(seed || '?') % PALETTE.length] ?? PALETTE[0];
}

export type AgentLike = {
  key?: string | null;
  name?: string | null;
  /** URL de la foto de avatar (subida al bucket). Sin ella, se usan iniciales. */
  avatar_url?: string | null;
};

export const AgentAvatar = ({
  agent,
  size = 28,
  dimmed = false,
  className = '',
}: {
  agent: AgentLike;
  size?: number;
  dimmed?: boolean;
  className?: string;
}) => {
  const name = (agent?.name ?? '').trim();
  const avatarUrl = agent?.avatar_url?.trim();
  const color = useMemo(() => colorForKey(agent?.key || name), [agent?.key, name]);
  const dims = { width: size, height: size, opacity: dimmed ? 0.45 : 1 } as const;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`shrink-0 rounded-full border border-ui-border-base object-cover ${className}`}
        style={dims}
      />
    );
  }

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-medium text-white ${className}`}
      style={{ ...dims, backgroundColor: color, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
};
