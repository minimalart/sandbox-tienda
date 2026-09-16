'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck, Plus, UserRound } from 'lucide-react';
import { checkoutRequest, type CheckoutState, type CheckoutPerson } from '@lib/hooks/use-checkout-policy';
import { useTenant } from '@lib/site-config/context';
import Students from './students';
import ProgressHeader from './progress-header';
import StudentCard from './student-card';
import StudentForm from './student-form';
import AssignmentSheet, { type SheetLine } from './assignment-sheet';
import Toast from './toast';

type LineInfo = { id: string; title: string; total: number };

const emptyDraft = (): CheckoutPerson => ({ id: '', document: '', first_name: '', last_name: '', grade: '' });

function StandardRecipients({ state, items, onSaved, onContinue, buyer }: { buyer?: { first_name?: string | null; last_name?: string | null }; state: CheckoutState; items: any[]; onSaved: (state: CheckoutState) => void; onContinue?: () => void }) {
  const [people, setPeople] = useState(state.people);
  const [assignments, setAssignments] = useState<Record<string, string>>(Object.fromEntries(state.units.map(u => [u.id, u.person_id ?? ''])));
  const [keep, setKeep] = useState<string[]>(state.units.map(u => u.id));
  const [draft, setDraft] = useState<CheckoutPerson>(emptyDraft());
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheetPersonId, setSheetPersonId] = useState<string | null>(null);
  const [sheetDraft, setSheetDraft] = useState<Record<string, number>>({});
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPeople(state.people);
    setAssignments(Object.fromEntries(state.units.map(u => [u.id, u.person_id ?? ''])));
    setKeep(state.units.map(u => u.id));
  }, [state.revision]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const lines: LineInfo[] = useMemo(() =>
    items
      .filter(i => state.units.some(u => u.line_id === i.id))
      .map(i => ({ id: i.id, title: i.product_title || i.title || 'Producto', total: state.units.filter(u => u.line_id === i.id).length })),
    [items, state.units]
  );

  const totalUnits = state.units.length;
  const assignedUnits = state.units.filter(u => assignments[u.id]).length;

  const assignedByPersonByLine = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const u of state.units) {
      const pid = assignments[u.id];
      if (!pid) continue;
      map[pid] ??= {};
      map[pid][u.line_id] = (map[pid][u.line_id] || 0) + 1;
    }
    return map;
  }, [assignments, state.units]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  };

  const openAddForm = () => { setEditing(null); setDraft(emptyDraft()); setFormError(''); setFormOpen(true); };
  const openEditForm = (p: CheckoutPerson) => { setEditing(p.id); setDraft({ ...p, grade: p.grade ?? '' }); setFormError(''); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setDraft(emptyDraft()); setFormError(''); };

  const submitForm = () => {
    const value: CheckoutPerson = {
      ...draft,
      document: (draft.document ?? '').replace(/[.\s-]/g, ''),
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
      grade: (draft.grade ?? '').trim() || undefined,
    };
    if (!value.first_name || !value.last_name) { setFormError('Completá nombre y apellido.'); return; }
    if (value.document && !/^\d{7,8}$/.test(value.document)) { setFormError('Si cargás un DNI tiene que tener 7 u 8 dígitos.'); return; }
    if (value.document) {
      const duplicate = people.find(p => p.document === value.document && p.id !== editing);
      if (duplicate) { setFormError('Ese DNI ya está cargado.'); return; }
    }
    const id = editing ?? crypto.randomUUID();
    setPeople(current => editing ? current.map(person => person.id === editing ? { ...value, id } : person) : [...current, { ...value, id }]);
    showToast(editing ? 'Datos del alumno actualizados' : 'Alumno agregado');
    closeForm();
  };

  const removePerson = (p: CheckoutPerson) => {
    if (Object.values(assignments).includes(p.id)) return;
    setPeople(current => current.filter(person => person.id !== p.id));
    showToast('Alumno eliminado');
  };

  const openSheet = (personId: string) => {
    const current = assignedByPersonByLine[personId] || {};
    setSheetDraft(Object.fromEntries(lines.map(l => [l.id, current[l.id] || 0])));
    setSheetPersonId(personId);
  };

  const availableFor = (lineId: string) => {
    const line = lines.find(l => l.id === lineId);
    if (!line) return 0;
    const usedByOthers = Object.entries(assignedByPersonByLine)
      .filter(([pid]) => pid !== sheetPersonId)
      .reduce((sum, [, byLine]) => sum + (byLine[lineId] || 0), 0);
    return line.total - usedByOthers;
  };

  const saveSheet = () => {
    if (!sheetPersonId) return;
    const personId = sheetPersonId;
    // Translate {line_id → target count} into per-unit assignments for this student:
    // free the current units assigned to this person, then reassign target count from the free pool.
    setAssignments(current => {
      const next = { ...current };
      for (const unit of state.units) if (next[unit.id] === personId) next[unit.id] = '';
      for (const line of lines) {
        const target = Math.max(0, sheetDraft[line.id] || 0);
        const free = state.units.filter(u => u.line_id === line.id && !next[u.id]);
        for (let i = 0; i < target && i < free.length; i++) next[free[i].id] = personId;
      }
      return next;
    });
    setSheetPersonId(null);
    showToast('Asignación actualizada');
  };

  // Atajo del caso 1-alumno: asigna TODAS las unidades pendientes al único
  // alumno cargado. Cuando el operador suma un segundo alumno el botón deja
  // de ofrecerse (el prorrateo ya no es obvio) y vuelve a haber que abrir el
  // sheet por alumno.
  const assignAllToOnly = () => {
    if (people.length !== 1) return;
    const personId = people[0].id;
    setAssignments(Object.fromEntries(state.units.map(u => [u.id, personId])));
    showToast('Todos los productos fueron asignados');
  };

  const save = async () => {
    setBusy(true); setError('');
    try {
      const payload = {
        action: 'recipients',
        revision: state.revision,
        people,
        assignments: Object.entries(assignments)
          .filter(([id, person]) => person && keep.includes(id))
          .map(([unit_id, person_id]) => ({ unit_id, person_id })),
        // Modo "una persona para toda la compra" retirado del UI: el atajo
        // "Asignar todos" cubre el mismo caso propagando el mismo person_id a
        // todas las units, así que el backend recibe siempre asignaciones
        // per-unit y `global_person_id` queda en null.
        global_person_id: null,
        ...(state.conflicts.length ? { keep_unit_ids: keep } : {}),
      };
      const result = await checkoutRequest(payload);
      onSaved(result); onContinue?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const activeSheetPerson = sheetPersonId ? people.find(p => p.id === sheetPersonId) : null;

  return (
    <div ref={root} className="space-y-5">
      <ProgressHeader assigned={assignedUnits} total={totalUnits} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Alumnos</h3>
            <p className="text-xs text-gray-600">{people.length} {people.length === 1 ? 'alumno' : 'alumnos'}</p>
          </div>
          {people.length === 1 && assignedUnits < totalUnits && (
            <button type="button" onClick={assignAllToOnly} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-[--primary-color] hover:bg-[--primary-soft-bg]">
              <CheckCheck size={14} /> Asignar todos
            </button>
          )}
        </div>

        {people.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-white p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[--primary-soft-bg] text-[--primary-color]">
              <UserRound size={21} />
            </div>
            <strong className="text-sm">Agregá un alumno</strong>
            <p className="text-xs text-gray-600">Completá sus datos para asignarle productos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {people.map(p => (
              <StudentCard
                key={p.id}
                person={p}
                assignedByLine={assignedByPersonByLine[p.id] || {}}
                lines={lines}
                canDelete={!Object.values(assignments).includes(p.id)}
                onEdit={() => openEditForm(p)}
                onDelete={() => removePerson(p)}
                onAssign={() => openSheet(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {formOpen ? (
        <StudentForm
          draft={draft}
          editing={!!editing}
          error={formError}
          buyer={buyer}
          onChange={setDraft}
          onCancel={closeForm}
          onSubmit={submitForm}
          onUseMyName={() => setDraft(d => ({ ...d, first_name: buyer?.first_name ?? '', last_name: buyer?.last_name ?? '' }))}
        />
      ) : (
        <button type="button" onClick={openAddForm} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm font-medium text-[--primary-color] hover:bg-[--primary-soft-bg]">
          <Plus size={16} /> Agregar alumno
        </button>
      )}

      {state.conflicts.length > 0 && items.filter(i => state.conflicts.includes(i.id)).map(item => (
        <fieldset key={item.id} className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
          <legend className="px-1 text-sm font-medium">{item.product_title || item.title} × {item.quantity}</legend>
          <p role="alert" className="text-sm text-amber-800">La cantidad disminuyó. Marcá las {item.quantity} unidades que querés conservar.</p>
          {state.units.filter(u => u.line_id === item.id).map((unit, index) => (
            <label key={unit.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" aria-label={`Conservar unidad ${index + 1} de ${item.title}`} checked={keep.includes(unit.id)} onChange={e => setKeep(k => e.target.checked ? [...k, unit.id] : k.filter(id => id !== unit.id))} />
              Unidad {index + 1}
            </label>
          ))}
        </fieldset>
      ))}

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {/* Bloqueamos el continue si aún hay units sin asignar: evita avanzar al step siguiente con la card marcada como completa cuando el backend rechazaría la orden. */}
      <button type="button" disabled={busy || formOpen || assignedUnits < totalUnits} className="w-full rounded bg-[--primary-color] px-4 py-3 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed" onClick={save}>
        {busy ? 'Guardando…' : assignedUnits < totalUnits ? `Faltan ${totalUnits - assignedUnits} ${totalUnits - assignedUnits === 1 ? 'unidad' : 'unidades'} por asignar` : 'Guardar destinatarios y continuar'}
      </button>

      {activeSheetPerson && (
        <AssignmentSheet
          studentName={`${activeSheetPerson.first_name} ${activeSheetPerson.last_name}`.trim()}
          lines={lines as SheetLine[]}
          draft={sheetDraft}
          availableFor={availableFor}
          onChange={setSheetDraft}
          onCancel={() => setSheetPersonId(null)}
          onSave={saveSheet}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}

export type RecipientsProps = Parameters<typeof StandardRecipients>[0];
export default function Recipients(props: RecipientsProps) {
 const tenant = useTenant();
 return tenant.template === "campaign" ? <Students {...props} /> : <StandardRecipients {...props} />;
}
