'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { Check, Minus, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import {
  checkoutRequest,
  type CheckoutPerson,
} from '@lib/hooks/use-checkout-policy';
import { recipientWording } from '@lib/site-config/template-helpers';
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from '@lib/util/placeholder-image';
import type { RecipientsProps } from './index';
import {
  assignedQuantity,
  assignmentProgress,
  assignStudentQuantities,
  selectedUnitIds,
  type Assignments,
  type StudentLine,
} from './student-assignments';

const outline =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';
const primary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[--primary-color] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40';
const blankStudent = (): CheckoutPerson => ({
  id: '',
  first_name: '',
  last_name: '',
  document: '',
  grade: '',
});

function ProductImage({ item }: { item: StudentLine }) {
  return (
    <img
      src={
        item.thumbnail || item.variant?.product?.thumbnail || PLACEHOLDER_IMAGE
      }
      onError={handleImageError}
      alt=""
      className="h-12 w-12 shrink-0 rounded-md border border-gray-100 bg-white object-contain p-1"
    />
  );
}

export default function Students({
  state,
  items,
  onSaved,
  onContinue,
}: RecipientsProps) {
  const initialAssignments = () =>
    Object.fromEntries(
      state.units.map((u) => [
        u.id,
        state.global_person_id || u.person_id || '',
      ]),
    );
  const [students, setStudents] = useState(state.people);
  const [assignments, setAssignments] =
    useState<Assignments>(initialAssignments);
  const [draft, setDraft] = useState<CheckoutPerson | null>(null);
  const [activeStudent, setActiveStudent] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [wizard, setWizard] = useState(false);
  const [pendingStudent, setPendingStudent] = useState<CheckoutPerson | null>(
    null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const lines: StudentLine[] = items.filter((item) =>
    state.units.some((u) => u.line_id === item.id),
  );
  const pending = lines.filter(
    (line) =>
      assignedQuantity(state.units, assignments, line.id) !==
      Number(line.quantity),
  );
  const progress = assignmentProgress(state.units, assignments, lines);
  const student =
    pendingStudent || students.find((p) => p.id === activeStudent);
  const modalOpen = !!draft || !!activeStudent;
  const closeModal = () => {
    setDraft(null);
    setActiveStudent(null);
    setPendingStudent(null);
    setWizard(false);
    setError('');
  };

  useEffect(() => {
    setPendingStudent(null);
    setWizard(false);
    setStudents(state.people);
    setAssignments(initialAssignments());
    setDraft(null);
    setActiveStudent(null);
    setError('');
  }, [state.revision]);
  useEffect(() => {
    if (draft)
      formRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [draft?.id]);
  useEffect(() => {
    if (activeStudent) selectorRef.current?.focus();
  }, [activeStudent]);

  const markDirty = () =>
    onSaved({
      ...state,
      recipients_complete: false,
      flow: { ...state.flow, ready: false },
    });
  const changeAssignments = (next: Assignments) => {
    setAssignments(next);
    markDirty();
    setError('');
  };
  const openAssignment = (id: string, preserveQuantities = false) => {
    setActiveStudent(id);
    setDraft(null);
    setError('');
    if (!preserveQuantities)
      setQuantities(
        Object.fromEntries(
          lines.map((line) => [
            line.id,
            assignedQuantity(state.units, assignments, line.id, id),
          ]),
        ),
      );
  };
  const saveStudent = () => {
    if (!draft) return;
    const value = {
      ...draft,
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
      document: (draft.document ?? '').replace(/[.\s-]/g, ''),
      grade: draft.grade?.trim() || '',
    };
    if (!value.first_name || !value.last_name) {
      setError('Completá el nombre y apellido del estudiante.');
      return;
    }
    if (value.document && !/^\d{7,8}$/.test(value.document)) {
      setError('Ingresá un DNI de 7 u 8 dígitos o dejalo vacío.');
      return;
    }
    if (
      value.document &&
      students.some((p) => p.id !== value.id && p.document === value.document)
    ) {
      setError(
        'Ese DNI ya está cargado. Reutilizá el estudiante o corregí los datos.',
      );
      return;
    }
    value.id ||= crypto.randomUUID();
    if (wizard) {
      setPendingStudent(value);
      openAssignment(value.id, !!pendingStudent);
      return;
    }
    setStudents((current) =>
      draft.id
        ? current.map((p) => (p.id === value.id ? value : p))
        : [...current, value],
    );
    setDraft(null);
    setError('');
    markDirty();
    if (!draft.id) openAssignment(value.id);
  };
  const removeStudent = (id: string) => {
    setStudents((current) => current.filter((p) => p.id !== id));
    changeAssignments(
      Object.fromEntries(
        Object.entries(assignments).filter(([, person]) => person !== id),
      ),
    );
    if (activeStudent === id) setActiveStudent(null);
    if (draft?.id === id) setDraft(null);
  };
  const save = async () => {
    if (pending.length || draft || activeStudent || busy) return;
    setBusy(true);
    setError('');
    try {
      const keep = selectedUnitIds(state.units, assignments, lines);
      const next = await checkoutRequest({
        action: 'recipients',
        revision: state.revision,
        people: students,
        global_person_id: null,
        assignments: keep
          .filter((id) => assignments[id])
          .map((unit_id) => ({ unit_id, person_id: assignments[unit_id] })),
        ...(state.conflicts.length ? { keep_unit_ids: keep } : {}),
      });
      onSaved(next);
      onContinue?.();
    } catch (e) {
      setError(recipientWording((e as Error).message, 'campaign'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="campaign-students">
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <section
          aria-label="Productos de la compra"
          className="space-y-3 border-b border-gray-200 pb-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Productos de la compra{' '}
              <span className="font-normal text-gray-500">
                ({progress.total - progress.pending} de {progress.total} ítems
                asignados)
              </span>
            </h3>
          </div>
          <ul
            className="flex flex-wrap gap-x-4 gap-y-3"
            aria-label="Estado de asignación por producto"
          >
            {lines.map((line) => {
              const count = assignedQuantity(state.units, assignments, line.id);
              const complete = count === Number(line.quantity);
              const remaining = Math.max(0, Number(line.quantity) - count);
              const excess = Math.max(0, count - Number(line.quantity));
              const name = line.product_title || line.title;
              const status = complete
                ? 'Asignación completa'
                : excess
                  ? `Quitá ${excess} ${excess === 1 ? 'unidad sobrante' : 'unidades sobrantes'}`
                  : `${remaining} ${remaining === 1 ? 'unidad por asignar' : 'unidades por asignar'}`;
              return (
                <li
                  key={line.id}
                  title={`${name}: ${status}`}
                  className="flex w-16 shrink-0 flex-col items-center"
                >
                  <img
                    src={
                      line.thumbnail ||
                      line.variant?.product?.thumbnail ||
                      PLACEHOLDER_IMAGE
                    }
                    onError={handleImageError}
                    alt=""
                    className={`h-16 w-16 rounded-full border bg-white object-contain p-2 ${complete ? 'border-green-200' : excess ? 'border-amber-300' : 'border-gray-200'}`}
                  />
                  <span
                    role="status"
                    aria-atomic="true"
                    className={`relative -mt-2 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ring-2 ring-white ${complete ? 'bg-green-600 text-white' : excess ? 'bg-amber-100 text-amber-900' : 'bg-gray-900 text-white'}`}
                  >
                    <span className="sr-only">
                      {name}: {status}
                    </span>
                    {complete ? (
                      <Check aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <span aria-hidden="true">
                        {excess ? `+${excess}` : remaining}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3" aria-label="Estudiantes">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Estudiantes ({students.length})
            </h3>
            <button
              className={`${outline} text-[--primary-color]`}
              type="button"
              disabled={!!draft || !!activeStudent}
              onClick={() => {
                setWizard(true);
                setPendingStudent(null);
                setDraft(blankStudent());
                setError('');
              }}
            >
              <Plus className="h-4 w-4" />
              Agregar estudiante
            </button>
          </div>
          {!students.length && !draft && (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-200 px-4 py-4">
              <span className="rounded-full bg-gray-50 p-3 text-[--primary-color]">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Agregá el primer estudiante
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Completá sus datos para asignarle productos.
                </p>
              </div>
            </div>
          )}

          {students.map((p) => {
            const products = lines.filter(
              (line) =>
                assignedQuantity(state.units, assignments, line.id, p.id) > 0,
            );
            return (
              <article
                key={p.id}
                className="space-y-3 rounded-lg border border-gray-200 p-3 sm:p-4"
              >
                <header className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-50 text-sm font-semibold text-[--primary-color]">
                    {p.first_name[0]}
                    {p.last_name[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words text-sm font-semibold text-gray-900">
                      {p.first_name} {p.last_name}
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {p.document ? `DNI ${p.document}` : 'DNI no informado'}
                      {p.grade ? ` · ${p.grade}` : ''} · {products.length}{' '}
                      {products.length === 1 ? 'producto' : 'productos'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-1 text-gray-500"
                    aria-label={`Editar a ${p.first_name} ${p.last_name}`}
                    disabled={!!draft || !!activeStudent}
                    onClick={() => {
                      setDraft({ ...p });
                      setError('');
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-red-600"
                    aria-label={`Eliminar a ${p.first_name} ${p.last_name}`}
                    disabled={!!draft || !!activeStudent}
                    onClick={() => removeStudent(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </header>
                {products.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50/60 p-2"
                  >
                    <ProductImage item={line} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">
                        {line.product_title || line.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {assignedQuantity(
                          state.units,
                          assignments,
                          line.id,
                          p.id,
                        )}{' '}
                        {assignedQuantity(
                          state.units,
                          assignments,
                          line.id,
                          p.id,
                        ) === 1
                          ? 'unidad'
                          : 'unidades'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="p-1 text-gray-500"
                      aria-label={`Quitar ${line.product_title || line.title} de ${p.first_name}`}
                      disabled={!!activeStudent || !!draft}
                      onClick={() =>
                        changeAssignments(
                          Object.fromEntries(
                            Object.entries(assignments).filter(
                              ([id, person]) =>
                                person !== p.id ||
                                !state.units.some(
                                  (u) => u.id === id && u.line_id === line.id,
                                ),
                            ),
                          ),
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-2 text-sm font-medium text-[--primary-color] hover:bg-gray-50 disabled:opacity-40"
                  disabled={!!draft || !!activeStudent}
                  onClick={() => openAssignment(p.id)}
                >
                  <Plus className="h-4 w-4" />
                  Asignar productos
                </button>
              </article>
            );
          })}
        </section>
      </fieldset>

      <Dialog
        open={modalOpen}
        onClose={closeModal}
        className="relative z-[10000]"
        data-testid="student-assignment-modal"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity duration-200 data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
          <DialogPanel
            transition
            className="flex h-[100dvh] w-full flex-col bg-white text-left shadow-xl transition duration-300 ease-out data-[closed]:translate-y-full motion-reduce:transition-none sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-xl sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95 sm:data-[closed]:opacity-0"
          >
            <header className="shrink-0 border-b border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  {wizard
                    ? 'Agregar estudiante'
                    : draft
                      ? 'Editar estudiante'
                      : 'Asignar productos'}
                </DialogTitle>
                <button
                  type="button"
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                  onClick={closeModal}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {wizard && (
                <ol
                  aria-label="Pasos para agregar estudiante"
                  className="mt-4 flex items-center gap-3 text-sm"
                >
                  {['Estudiante', 'Asignar productos'].map((label, index) => {
                    const current = draft ? 0 : 1;
                    return (
                      <li
                        key={label}
                        aria-current={current === index ? 'step' : undefined}
                        className="flex flex-1 items-center gap-2"
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index <= current ? 'bg-[--primary-color] text-white' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {index < current ? (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span
                          className={
                            index === current
                              ? 'font-semibold text-gray-900'
                              : 'text-gray-500'
                          }
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
              {draft && (
                <div
                  ref={formRef}
                  role="group"
                  aria-label={
                    wizard ? 'Agregar estudiante' : 'Editar estudiante'
                  }
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(
                      [
                        ['first_name', 'Nombre', 'Ej. Ana'],
                        ['last_name', 'Apellido', 'Ej. García'],
                        ['document', 'DNI (opcional)', 'Ej. 40123456'],
                        ['grade', 'Grado / Curso (opcional)', 'Ej. 3.º A'],
                      ] as const
                    ).map(([field, label, placeholder]) => (
                      <label
                        className="text-xs font-medium text-gray-700"
                        key={field}
                      >
                        {label}
                        {(field === 'first_name' || field === 'last_name') && (
                          <span className="text-[--primary-color]"> *</span>
                        )}
                        <input
                          aria-required={
                            field === 'first_name' || field === 'last_name'
                          }
                          aria-describedby={error ? 'student-error' : undefined}
                          autoComplete="off"
                          inputMode={field === 'document' ? 'numeric' : 'text'}
                          maxLength={
                            field === 'document'
                              ? 12
                              : field === 'grade'
                                ? 50
                                : 100
                          }
                          value={draft[field] || ''}
                          placeholder={placeholder}
                          onChange={(e) =>
                            setDraft({ ...draft, [field]: e.target.value })
                          }
                          className="mt-1.5 w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[--primary-color] focus:ring-1 focus:ring-[--primary-color]"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className={outline}
                      onClick={closeModal}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={primary}
                      onClick={saveStudent}
                    >
                      {wizard
                        ? 'Continuar: asignar productos'
                        : 'Guardar estudiante'}
                    </button>
                  </div>
                </div>
              )}

              {student && activeStudent && (
                <div
                  ref={selectorRef}
                  tabIndex={-1}
                  role="group"
                  aria-label={`Asignar productos a ${student.first_name} ${student.last_name}`}
                  className="space-y-3 outline-none"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        Asignar productos a {student.first_name}{' '}
                        {student.last_name}
                      </h4>
                      <p className="mt-1 text-xs text-gray-500">
                        Seleccioná la cantidad que recibirá este estudiante.
                      </p>
                    </div>
                  </div>
                  {lines.map((line) => {
                    const otherCount = state.units.filter(
                      (u) =>
                        u.line_id === line.id &&
                        assignments[u.id] &&
                        assignments[u.id] !== student.id,
                    ).length;
                    const max = Math.max(0, line.quantity - otherCount);
                    const count = quantities[line.id] || 0;
                    return (
                      <div
                        key={line.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <ProductImage item={line} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900">
                            {line.product_title || line.title}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Disponible para asignar: {Math.max(0, max - count)}{' '}
                            de {line.quantity}
                          </p>
                        </div>
                        <div className="flex items-center rounded-md border border-gray-200">
                          <button
                            type="button"
                            className="p-2 disabled:opacity-30"
                            disabled={count <= 0}
                            aria-label={`Reducir ${line.product_title || line.title}`}
                            onClick={() =>
                              setQuantities((q) => ({
                                ...q,
                                [line.id]: Math.max(0, count - 1),
                              }))
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <output
                            aria-label={`Cantidad de ${line.product_title || line.title}`}
                            className="min-w-8 text-center text-sm"
                          >
                            {count}
                          </output>
                          <button
                            type="button"
                            className="p-2 disabled:opacity-30"
                            disabled={count >= max}
                            aria-label={`Aumentar ${line.product_title || line.title}`}
                            onClick={() =>
                              setQuantities((q) => ({
                                ...q,
                                [line.id]: Math.min(max, count + 1),
                              }))
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-3">
                    {wizard && (
                      <button
                        type="button"
                        className={outline}
                        onClick={() => {
                          setDraft({ ...student });
                          setActiveStudent(null);
                          setError('');
                        }}
                      >
                        Atrás
                      </button>
                    )}
                    <button
                      type="button"
                      className={outline}
                      onClick={closeModal}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={primary}
                      onClick={() => {
                        if (pendingStudent)
                          setStudents((current) => [
                            ...current,
                            pendingStudent,
                          ]);
                        changeAssignments(
                          assignStudentQuantities(
                            state.units,
                            assignments,
                            lines,
                            student.id,
                            quantities,
                          ),
                        );
                        closeModal();
                      }}
                    >
                      Asignar productos (
                      {Object.values(quantities).reduce(
                        (sum, quantity) => sum + quantity,
                        0,
                      )}
                      )
                    </button>
                  </div>
                </div>
              )}
              {error && (
                <p
                  role="alert"
                  id="student-error"
                  className="mt-3 text-sm text-red-600"
                >
                  {error}
                </p>
              )}
            </div>
          </DialogPanel>
        </div>
      </Dialog>
      {error && !modalOpen && (
        <p role="alert" id="student-error" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        className={`${primary} w-full py-3`}
        disabled={busy || pending.length > 0 || !!draft || !!activeStudent}
        onClick={save}
      >
        {busy
          ? 'Guardando…'
          : progress.pending
            ? `Falta asignar ${progress.pending} ${progress.pending === 1 ? 'ítem' : 'ítems'}`
            : pending.length
              ? 'Revisá las cantidades asignadas'
              : 'Guardar estudiantes y continuar'}
      </button>
    </div>
  );
}
