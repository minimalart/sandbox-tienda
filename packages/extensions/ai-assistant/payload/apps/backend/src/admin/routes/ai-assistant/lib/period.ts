// Selección de período: presets simples que producen un rango {from,to} en ISO
// (YYYY-MM-DD). "sin filtro" => null (el backend usa su default de 30 días).

export type PeriodValue = { from: string; to: string } | null;

export type PeriodPreset =
  | 'none'
  | 'this_month'
  | 'last_month'
  | '3m'
  | '6m'
  | '12m'
  | 'custom';

export const PERIOD_OPTIONS: { id: PeriodPreset; label: string }[] = [
  { id: 'none', label: 'Sin filtro (30 días)' },
  { id: 'this_month', label: 'Este mes' },
  { id: 'last_month', label: 'Mes anterior' },
  { id: '3m', label: 'Últimos 3 meses' },
  { id: '6m', label: 'Últimos 6 meses' },
  { id: '12m', label: 'Últimos 12 meses' },
  { id: 'custom', label: 'Personalizado…' },
];

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function periodFromPreset(preset: PeriodPreset): PeriodValue {
  const now = new Date();
  // 'custom' lo resuelve la UI con los date pickers; acá devolvemos null.
  if (preset === 'none' || preset === 'custom') return null;

  if (preset === 'this_month') {
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
  }
  if (preset === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: isoDate(from), to: isoDate(to) };
  }
  const months = preset === '3m' ? 3 : preset === '6m' ? 6 : 12;
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return { from: isoDate(from), to: isoDate(now) };
}
