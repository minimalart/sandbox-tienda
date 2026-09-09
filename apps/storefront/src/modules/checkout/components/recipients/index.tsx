'use client';
import { useEffect, useRef, useState } from 'react';
import { checkoutRequest, type CheckoutState, type CheckoutPerson } from '@lib/hooks/use-checkout-policy';

export default function Recipients({ state, items, onSaved, onContinue, buyer }: { buyer?: { first_name?: string | null; last_name?: string | null }; state: CheckoutState; items: any[]; onSaved: (state: CheckoutState) => void; onContinue?: () => void }) {
  const [people, setPeople] = useState(state.people);
  const [assignments, setAssignments] = useState<Record<string, string>>(Object.fromEntries(state.units.map(u => [u.id, u.person_id ?? ''])));
  const [globalId, setGlobalId] = useState(state.global_person_id ?? '');
  const [mode, setMode] = useState<'global' | 'individual'>(state.global_person_id || !state.people.length ? 'global' : 'individual');
  const [keep, setKeep] = useState<string[]>(state.units.map(u => u.id));
  const [draft, setDraft] = useState<CheckoutPerson>({ id: '', document: '', first_name: '', last_name: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPeople(state.people); setAssignments(Object.fromEntries(state.units.map(u => [u.id, u.person_id ?? '']))); setGlobalId(state.global_person_id ?? ''); setKeep(state.units.map(u => u.id));
  }, [state.revision]);
  const addPerson = () => {
    const value = { ...draft, document: draft.document.replace(/[.\s-]/g, ''), first_name: draft.first_name.trim(), last_name: draft.last_name.trim() };
    if (!/^\d{7,8}$/.test(value.document) || !value.first_name || !value.last_name) { setError('Ingresá DNI de 7 u 8 dígitos, nombre y apellido.'); root.current?.querySelector<HTMLInputElement>('input')?.focus(); return; }
    const duplicate = people.find(p => p.document === value.document && p.id !== editing);
    if (duplicate) { setError('Ese DNI ya está cargado. Reutilizá la persona o corregí los datos.'); return; }
    const id = editing ?? crypto.randomUUID();
    setPeople(p => editing ? p.map(person => person.id === editing ? { ...value, id } : person) : [...p, { ...value, id }]);
    if (!globalId) setGlobalId(id);
    setDraft({ id: '', document: '', first_name: '', last_name: '' }); setEditing(null); setError('');
  };
  const save = async () => {
    setBusy(true); setError('');
    try {
      const result = await checkoutRequest({ action: 'recipients', revision: state.revision, people, assignments: Object.entries(assignments).filter(([id, person]) => person && keep.includes(id)).map(([unit_id, person_id]) => ({ unit_id, person_id })), global_person_id: mode === 'global' ? globalId || null : null, ...(state.conflicts.length ? { keep_unit_ids: keep } : {}) });
      onSaved(result); onContinue?.();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const personOptions = <><option value="">Seleccioná una persona</option>{people.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} · DNI •••{p.document.slice(-3)}</option>)}</>;
  return <div ref={root} className="space-y-4">
    <p className="text-sm text-gray-600">{state.policy.recipients.help}</p>
    <div className="flex flex-wrap gap-3" role="group" aria-label="Asignación de destinatarios">
      <button type="button" aria-pressed={mode === 'global'} className="rounded border px-3 py-2 text-sm" onClick={() => { if (mode === 'individual' && new Set(Object.values(assignments).filter(Boolean)).size > 1) setReplaceConfirm(true); else setMode('global'); }}>Una persona para toda la compra</button>
      <button type="button" aria-pressed={mode === 'individual'} className="rounded border px-3 py-2 text-sm" onClick={() => { if (mode === 'global' && globalId) setAssignments(Object.fromEntries(state.units.map(u => [u.id, globalId]))); setMode('individual'); }}>Asignar por producto o unidad</button>
    </div>
    {replaceConfirm && <div role="alert" className="rounded border p-3 text-sm">Esta acción reemplazará las asignaciones de todas las unidades.<div className="mt-2 flex gap-3"><button type="button" onClick={() => { setMode('global'); setReplaceConfirm(false); }}>Confirmar sustitución</button><button type="button" onClick={() => setReplaceConfirm(false)}>Cancelar</button></div></div>}
    <div className="space-y-2">{people.map(p => <div key={p.id} className="flex items-center justify-between gap-3 rounded border p-3 text-sm"><span>{p.first_name} {p.last_name} · DNI •••{p.document.slice(-3)}</span><button type="button" className="underline" onClick={() => { setDraft(p); setEditing(p.id); }}>Editar</button>{!(mode === 'global' ? globalId === p.id : Object.values(assignments).includes(p.id)) && <button type="button" className="underline" onClick={() => { setPeople(current => current.filter(person => person.id !== p.id)); if (editing === p.id) { setEditing(null); setDraft({ id: '', document: '', first_name: '', last_name: '' }); } }}>Eliminar</button>}</div>)}</div>
    <fieldset className="space-y-3 rounded border p-4"><legend className="px-1 text-sm font-medium">{editing ? 'Editar persona' : 'Agregar persona'}</legend>
      {buyer && !editing && <button type="button" className="text-sm underline" onClick={() => setDraft(d => ({ ...d, first_name: buyer.first_name ?? '', last_name: buyer.last_name ?? '' }))}>Usar mi nombre y apellido</button>}
      {editing && <p className="text-sm text-gray-600">Los cambios se aplicarán a todas sus unidades asignadas ({state.units.filter(u => assignments[u.id] === editing || (mode === 'global' && globalId === editing)).length}).</p>}
      <div className="grid gap-3 sm:grid-cols-3">{(['document', 'first_name', 'last_name'] as const).map(field => <label key={field} className="text-sm">{field === 'document' ? 'DNI' : field === 'first_name' ? 'Nombre' : 'Apellido'}<input className="mt-1 w-full rounded border px-3 py-2" aria-describedby={error ? "recipient-error" : undefined} inputMode={field === 'document' ? 'numeric' : 'text'} autoComplete="off" maxLength={field === 'document' ? 12 : 100} value={draft[field]} onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))} /></label>)}</div>
      <button type="button" className="rounded border px-3 py-2 text-sm" onClick={addPerson}>{editing ? 'Actualizar persona' : 'Agregar y reutilizar'}</button>
    </fieldset>
    {mode === 'global' && <label className="block text-sm">Persona para todas las unidades<select className="mt-1 block w-full rounded border p-2" value={globalId} onChange={e => setGlobalId(e.target.value)}>{personOptions}</select></label>}
    {(mode === 'individual' || state.conflicts.length > 0) && items.filter(i => state.units.some(u => u.line_id === i.id)).map(item => <fieldset key={item.id} className="space-y-2 rounded border p-3"><legend className="px-1 text-sm font-medium">{item.product_title || item.title} × {item.quantity}</legend>
      {state.conflicts.includes(item.id) && <p role="alert" className="text-sm text-amber-800">La cantidad disminuyó. Marcá las {item.quantity} unidades que querés conservar.</p>}
      {mode === 'individual' && <select aria-label={`Asignar todas las unidades de ${item.title}`} className="w-full rounded border p-2 text-sm" value="" onChange={e => setAssignments(a => ({ ...a, ...Object.fromEntries(state.units.filter(u => u.line_id === item.id).map(u => [u.id, e.target.value])) }))}><option value="">Aplicar una persona a este producto</option>{people.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select>}
      {state.units.filter(u => u.line_id === item.id).map((unit, index) => <div key={unit.id} className="flex items-center gap-2 text-sm">{state.conflicts.includes(item.id) && <input type="checkbox" aria-label={`Conservar unidad ${index + 1} de ${item.title}`} checked={keep.includes(unit.id)} onChange={e => setKeep(k => e.target.checked ? [...k, unit.id] : k.filter(id => id !== unit.id))} />}<label className="flex w-full items-center gap-2">Unidad {index + 1}<select disabled={mode === 'global'} className="min-w-0 flex-1 rounded border p-2" value={mode === 'global' ? globalId : assignments[unit.id] || ''} onChange={e => setAssignments(a => ({ ...a, [unit.id]: e.target.value }))}>{personOptions}</select></label></div>)}
    </fieldset>)}
    {people.length > 0 && <div aria-label="Resumen por destinatario" className="space-y-1 text-sm">{people.map(person => { const assigned = state.units.filter(u => keep.includes(u.id) && (mode === 'global' ? globalId === person.id : assignments[u.id] === person.id)); return assigned.length ? <p key={person.id}>{person.first_name} {person.last_name} · DNI •••{person.document.slice(-3)}: {assigned.length} unidades</p> : null; })}</div>}
    {error && <p id="recipient-error" role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="button" disabled={busy || !!editing} className="w-full rounded bg-[--primary-color] px-4 py-3 text-sm font-medium text-white disabled:opacity-50" onClick={save}>{busy ? 'Guardando…' : 'Guardar destinatarios y continuar'}</button>
  </div>;
}
