import type { CheckoutUnit } from '@lib/hooks/use-checkout-policy';

export type Assignments = Record<string, string>;
export type StudentLine = {
  id: string;
  quantity: number;
  title?: string;
  product_title?: string;
  thumbnail?: string | null;
  variant?: { product?: { thumbnail?: string | null } };
};

export function assignedQuantity(
  units: CheckoutUnit[],
  assignments: Assignments,
  lineId: string,
  studentId?: string,
) {
  return units.filter(
    (u) =>
      u.line_id === lineId &&
      assignments[u.id] &&
      (!studentId || assignments[u.id] === studentId),
  ).length;
}

/** Count purchased units, keeping surplus on one line from hiding missing units on another. */
export function assignmentProgress(
  units: CheckoutUnit[],
  assignments: Assignments,
  lines: StudentLine[],
) {
  return lines.reduce(
    (progress, line) => ({
      total: progress.total + Number(line.quantity),
      pending:
        progress.pending +
        Math.max(
          0,
          Number(line.quantity) - assignedQuantity(units, assignments, line.id),
        ),
    }),
    { total: 0, pending: 0 },
  );
}

/** Reuse server unit IDs; never invent IDs or move another student's units. */
export function assignStudentQuantities(
  units: CheckoutUnit[],
  assignments: Assignments,
  lines: StudentLine[],
  studentId: string,
  quantities: Record<string, number>,
): Assignments {
  const next = { ...assignments };
  for (const line of lines) {
    const lineUnits = units.filter((u) => u.line_id === line.id);
    const otherCount = lineUnits.filter(
      (u) => next[u.id] && next[u.id] !== studentId,
    ).length;
    const quantity = Math.max(
      0,
      Math.min(
        Math.floor(quantities[line.id] || 0),
        line.quantity - otherCount,
      ),
    );
    const available = lineUnits
      .filter((u) => next[u.id] === studentId)
      .concat(lineUnits.filter((u) => !next[u.id]));
    for (const u of lineUnits) if (next[u.id] === studentId) delete next[u.id];
    for (const u of available.slice(0, quantity)) next[u.id] = studentId;
  }
  return next;
}

/** A cart reduction keeps the explicitly assigned units after quantities are corrected. */
export function selectedUnitIds(
  units: CheckoutUnit[],
  assignments: Assignments,
  lines: StudentLine[],
) {
  return lines.flatMap((line) => {
    const candidates = units.filter((u) => u.line_id === line.id);
    return [
      ...candidates.filter((u) => assignments[u.id]),
      ...candidates.filter((u) => !assignments[u.id]),
    ]
      .slice(0, line.quantity)
      .map((u) => u.id);
  });
}
