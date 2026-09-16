'use client';
import { X } from 'lucide-react';
import type { CheckoutPerson } from '@lib/hooks/use-checkout-policy';

export default function StudentForm({
  draft, editing, onChange, onCancel, onSubmit, error, buyer, onUseMyName,
}: {
  draft: CheckoutPerson;
  editing: boolean;
  onChange: (next: CheckoutPerson) => void;
  onCancel: () => void;
  onSubmit: () => void;
  error?: string;
  buyer?: { first_name?: string | null; last_name?: string | null };
  onUseMyName?: () => void;
}) {
  const field = <K extends keyof CheckoutPerson>(k: K, v: CheckoutPerson[K]) => onChange({ ...draft, [k]: v });
  return (
    <form
      className="space-y-4 rounded-lg border border-border bg-white p-4"
      onSubmit={e => { e.preventDefault(); onSubmit(); }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Destinatario</div>
          <h3 className="text-base font-semibold">{editing ? 'Editar alumno' : 'Agregar alumno'}</h3>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cerrar formulario" className="rounded-md p-2 text-gray-600 hover:bg-gray-100">
          <X size={18} />
        </button>
      </div>

      {buyer && !editing && (
        <button type="button" className="text-xs text-[--primary-color] underline" onClick={onUseMyName}>
          Usar mi nombre y apellido
        </button>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block">Nombre <span className="text-red-600">*</span></span>
          <input required value={draft.first_name} onChange={e => field('first_name', e.target.value)} placeholder="Ej. Ana" className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]" maxLength={100} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Apellido <span className="text-red-600">*</span></span>
          <input required value={draft.last_name} onChange={e => field('last_name', e.target.value)} placeholder="Ej. García" className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]" maxLength={100} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">DNI <span className="text-gray-500">(opcional)</span></span>
          <input value={draft.document ?? ''} onChange={e => field('document', e.target.value)} placeholder="Ej. 40123456" inputMode="numeric" maxLength={12} autoComplete="off" className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block">Grado <span className="text-gray-500">(opcional)</span></span>
          <input value={draft.grade ?? ''} onChange={e => field('grade', e.target.value)} placeholder="Ej. 3° A" maxLength={50} className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]" />
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="rounded-md bg-[--primary-color] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          {editing ? 'Guardar cambios' : 'Agregar alumno'}
        </button>
      </div>
    </form>
  );
}
