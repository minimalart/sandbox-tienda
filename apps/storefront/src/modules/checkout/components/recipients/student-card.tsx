'use client';
import { Pencil, Trash2, Plus } from 'lucide-react';
import type { CheckoutPerson } from '@lib/hooks/use-checkout-policy';

type LineInfo = { id: string; title: string };

export default function StudentCard({
  person, assignedByLine, lines, canDelete, onEdit, onDelete, onAssign,
}: {
  person: CheckoutPerson;
  assignedByLine: Record<string, number>;
  lines: LineInfo[];
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
}) {
  const fullName = `${person.first_name} ${person.last_name}`.trim();
  const initial = (person.first_name || '?').slice(0, 1).toUpperCase();
  const subtitleParts = [person.document ? `DNI ${person.document}` : 'DNI no informado'];
  if (person.grade) subtitleParts.push(person.grade);
  const chips = lines.filter(l => assignedByLine[l.id] > 0);
  return (
    <article className="space-y-3 rounded-lg border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[--primary-soft-bg] text-lg font-semibold text-[--primary-color]">{initial}</div>
          <div>
            <div className="text-sm font-medium">{fullName}</div>
            <div className="text-xs text-gray-600">{subtitleParts.join(' · ')}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onEdit} aria-label={`Editar ${fullName}`} className="rounded-md p-2 text-gray-600 hover:bg-gray-100">
            <Pencil size={16} />
          </button>
          {canDelete && (
            <button type="button" onClick={onDelete} aria-label={`Eliminar ${fullName}`} className="rounded-md p-2 text-red-600 hover:bg-red-50">
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map(l => (
            <span key={l.id} className="inline-flex items-center gap-1 rounded-full bg-[--primary-soft-bg] px-2.5 py-1 text-xs text-[--primary-color]">
              {l.title} <b>× {assignedByLine[l.id]}</b>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Todavía no tiene productos asignados.</p>
      )}
      <button type="button" onClick={onAssign} className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border px-3 py-2 text-sm text-[--primary-color] hover:bg-[--primary-soft-bg]">
        <Plus size={14} /> Asignar productos
      </button>
    </article>
  );
}
