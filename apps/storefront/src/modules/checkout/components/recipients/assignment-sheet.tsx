'use client';
import { useEffect } from 'react';
import { Minus, Plus, X } from 'lucide-react';

export type SheetLine = { id: string; title: string; total: number };

export default function AssignmentSheet({
  studentName, lines, draft, availableFor, onChange, onCancel, onSave,
}: {
  studentName: string;
  lines: SheetLine[];
  draft: Record<string, number>;
  availableFor: (lineId: string) => number;
  onChange: (next: Record<string, number>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const set = (id: string, v: number) => onChange({ ...draft, [id]: v });
  return (
    <div className="fixed inset-0 z-50 flex cursor-modal-close items-end justify-center bg-black/50 sm:items-center" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <section role="dialog" aria-modal="true" aria-label={`Asignar productos a ${studentName}`} className="flex max-h-[86vh] w-full cursor-auto flex-col rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border bg-white p-4 sm:rounded-t-2xl">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Asignar productos a</div>
            <h2 className="text-lg font-semibold">{studentName}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cerrar" className="rounded-md p-2 text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {lines.length === 0 && <p className="text-sm text-gray-600">No hay productos disponibles para asignar.</p>}
          {lines.map(line => {
            const max = Math.max(0, availableFor(line.id));
            const value = Math.min(draft[line.id] || 0, max);
            return (
              <div key={line.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{line.title}</div>
                  <div className="text-xs text-gray-600">{max} {max === 1 ? 'unidad disponible' : 'unidades disponibles'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={value <= 0} onClick={() => set(line.id, Math.max(0, value - 1))} aria-label={`Quitar unidad de ${line.title}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                    <Minus size={14} />
                  </button>
                  <span className="min-w-[1.5rem] text-center text-sm font-medium tabular-nums">{value}</span>
                  <button type="button" disabled={value >= max} onClick={() => set(line.id, value + 1)} aria-label={`Sumar unidad de ${line.title}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-white p-4 sm:rounded-b-2xl">
          <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={onSave} className="rounded-md bg-[--primary-color] px-4 py-2 text-sm font-medium text-white hover:opacity-90">Guardar asignación</button>
        </div>
      </section>
    </div>
  );
}
