import type { CheckoutUnit } from '@lib/hooks/use-checkout-policy';
import type { Assignments, StudentLine } from './student-assignments';

/**
 * Unidad de asignación del checkout (PRD Bundles V2 §22-§26).
 *
 * El destinatario de un kit pertenece al KIT, no a cada producto que lo compone:
 * pedir "¿para quién es?" doce veces para un kit de doce productos es pedir doce
 * veces la misma respuesta. Acá se agrupan los line items por
 * `bundle_instance_id` y el kit pasa a ser UN target con un solo cupo.
 *
 * Lo que viaja al servidor NO cambia: sigue siendo `unit_id → person_id`. El kit
 * es una unidad de PRESENTACIÓN y de decisión; al guardar se expande a todas sus
 * unidades, que es exactamente lo que el PRD describe para la orden (§26). Por
 * eso esta etapa no necesita tabla nueva (§25).
 *
 * Módulo puro: sin React ni fetch, así se puede testear la aritmética de cupos
 * —que es donde estaban los bugs de asignación— sin montar el checkout.
 */

export type AssignmentTargetKind = 'line' | 'bundle';

export interface AssignmentTarget {
  /** `line.id`, o `bundle:<bundle_instance_id>` para un kit. */
  id: string;
  kind: AssignmentTargetKind;
  title: string;
  /** Renglón secundario: para un kit, cuántos productos trae. */
  subtitle?: string;
  thumbnail: string | null;
  /**
   * Fotos de lo que hay adentro, para que un kit se distinga de un producto de
   * un vistazo: la pila de miniaturas es la misma señal que usa el carrito.
   * Una línea suelta trae una sola.
   */
  thumbnails: string[];
  /** Cupos asignables. Un kit tiene UNO aunque adentro haya doce productos. */
  quantity: number;
  /** Unidades del servidor que cubre este target, en orden estable. */
  unitIds: string[];
  /** Line items que agrupa (uno, salvo que sea kit). */
  lineIds: string[];
}

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const lineThumbnail = (line: StudentLine): string | null =>
  line.thumbnail ?? line.variant?.product?.thumbnail ?? null;

const lineTitle = (line: StudentLine): string => line.product_title || line.title || 'Producto';

/**
 * Arma los targets a partir de los line items y las unidades del servidor.
 *
 * Sólo entran las líneas que tienen unidades: una línea sin unidades no es
 * asignable y mostrarla sería prometer algo que no se puede completar.
 */
export const buildAssignmentTargets = (
  items: readonly StudentLine[],
  units: readonly CheckoutUnit[],
): AssignmentTarget[] => {
  const unitsByLine = new Map<string, string[]>();
  for (const unit of units) {
    const list = unitsByLine.get(unit.line_id);
    if (list) list.push(unit.id);
    else unitsByLine.set(unit.line_id, [unit.id]);
  }

  const targets: AssignmentTarget[] = [];
  const bundleIndex = new Map<string, AssignmentTarget>();

  for (const item of items) {
    const unitIds = unitsByLine.get(item.id);
    if (!unitIds?.length) continue;

    const meta = (item as { metadata?: Record<string, unknown> | null }).metadata ?? null;
    const instanceId = str(meta?.bundle_instance_id);

    if (!instanceId) {
      const thumbnail = lineThumbnail(item);
      targets.push({
        id: item.id,
        kind: 'line',
        title: lineTitle(item),
        thumbnail,
        thumbnails: thumbnail ? [thumbnail] : [],
        quantity: Number(item.quantity) || unitIds.length,
        unitIds: [...unitIds],
        lineIds: [item.id],
      });
      continue;
    }

    const existing = bundleIndex.get(instanceId);
    if (existing) {
      existing.unitIds.push(...unitIds);
      existing.lineIds.push(item.id);
      existing.subtitle = `${existing.lineIds.length} productos`;
      const next = lineThumbnail(item);
      if (next && !existing.thumbnails.includes(next)) existing.thumbnails.push(next);
      continue;
    }

    const first = lineThumbnail(item);
    const target: AssignmentTarget = {
      id: `bundle:${instanceId}`,
      kind: 'bundle',
      title: str(meta?.bundle_title) ?? 'Kit',
      subtitle: '1 producto',
      thumbnail: first,
      thumbnails: first ? [first] : [],
      // UN cupo: el kit entero va a una sola persona.
      quantity: 1,
      unitIds: [...unitIds],
      lineIds: [item.id],
    };
    bundleIndex.set(instanceId, target);
    targets.push(target);
  }

  return targets;
};

/**
 * Cuántas unidades del servidor equivalen a un cupo.
 *
 * Para una línea suelta es 1 (cupo = unidad, el comportamiento de siempre); para
 * un kit son todas sus unidades, porque el cupo es el kit completo.
 */
const slotSize = (target: AssignmentTarget): number =>
  target.quantity > 0 ? Math.max(1, Math.floor(target.unitIds.length / target.quantity)) : 1;

/** Cupos ya asignados de un target (a `studentId`, o a cualquiera si se omite). */
export const targetAssignedQuantity = (
  units: readonly CheckoutUnit[],
  assignments: Assignments,
  target: AssignmentTarget,
  studentId?: string,
): number => {
  const assigned = target.unitIds.filter(
    (unitId) => assignments[unitId] && (!studentId || assignments[unitId] === studentId),
  ).length;
  return Math.floor(assigned / slotSize(target));
};

/** Progreso en cupos, no en unidades: un kit pendiente es UN ítem por asignar. */
export const targetsProgress = (
  units: readonly CheckoutUnit[],
  assignments: Assignments,
  targets: readonly AssignmentTarget[],
): { total: number; pending: number } =>
  targets.reduce(
    (progress, target) => ({
      total: progress.total + target.quantity,
      pending:
        progress.pending +
        Math.max(0, target.quantity - targetAssignedQuantity(units, assignments, target)),
    }),
    { total: 0, pending: 0 },
  );

/**
 * Asigna `quantities[target.id]` cupos de cada target al estudiante.
 *
 * Reusa los ids de unidad del servidor y nunca mueve las de otro estudiante, que
 * es la misma regla que ya tenía la asignación por línea.
 */
export const assignTargetQuantities = (
  units: readonly CheckoutUnit[],
  assignments: Assignments,
  targets: readonly AssignmentTarget[],
  studentId: string,
  quantities: Record<string, number>,
): Assignments => {
  const next = { ...assignments };

  for (const target of targets) {
    const size = slotSize(target);
    const takenByOthers = target.unitIds.filter(
      (id) => next[id] && next[id] !== studentId,
    ).length;
    const slotsForOthers = Math.floor(takenByOthers / size);
    const wanted = Math.max(
      0,
      Math.min(Math.floor(quantities[target.id] || 0), target.quantity - slotsForOthers),
    );

    // Se liberan las del estudiante y se vuelven a tomar desde el principio:
    // así el resultado no depende del orden en que se fue tocando el stepper.
    for (const id of target.unitIds) if (next[id] === studentId) delete next[id];
    const free = target.unitIds.filter((id) => !next[id]);
    for (const id of free.slice(0, wanted * size)) next[id] = studentId;
  }

  return next;
};

/**
 * Unidades que quedan seleccionadas al guardar, respetando el cupo de cada
 * target. Las asignadas explícitamente van primero.
 */
export const selectedTargetUnitIds = (
  units: readonly CheckoutUnit[],
  assignments: Assignments,
  targets: readonly AssignmentTarget[],
): string[] =>
  targets.flatMap((target) => {
    const assigned = target.unitIds.filter((id) => assignments[id]);
    const rest = target.unitIds.filter((id) => !assignments[id]);
    return [...assigned, ...rest].slice(0, target.quantity * slotSize(target));
  });
