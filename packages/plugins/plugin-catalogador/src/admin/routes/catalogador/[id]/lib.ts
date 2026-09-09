/**
 * Qué valor de un campo se le muestra al operador, y si es suyo o de la IA.
 *
 * Vive separado del `page.tsx` y sin imports de React para poder testearse
 * (misma convención que `api/.../products/[pid]/lib.ts`). Existe porque esta
 * decisión estuvo MAL y en silencio: la pantalla mostraba siempre
 * `proposed_changes[field].value`, así que después de editar y guardar volvía a
 * aparecer el texto de la IA. El backend guardaba bien —`accepted_changes[field]`
 * con el texto nuevo y `status: accepted`— pero desde la UI se leía como "no me
 * guarda los ajustes", y encima invitaba a apretar "Aceptar", que sí pisa la
 * edición con la propuesta.
 */

/** Una propuesta tal como la guarda el backend. */
export type Proposal = { value?: unknown; confidence?: number } | undefined;

export type ProposalView = {
  /** El valor que el apply va a ESCRIBIR al producto. */
  effective: unknown;
  /** Texto del bloque principal (el efectivo, ya formateado). */
  shownText: string;
  /** Texto de la propuesta original de la IA, ya formateado. */
  aiText: string;
  /** Hay una decisión guardada para el campo. */
  isAccepted: boolean;
  /** Hay decisión guardada Y su texto difiere de la propuesta de la IA. */
  isEdited: boolean;
};

/**
 * La decisión del usuario le gana a la propuesta.
 *
 * `isEdited` se calcula comparando los textos ya FORMATEADOS y no por identidad:
 * los campos de array (`categories`, `keywords`) nunca son `===` aunque tengan
 * los mismos elementos, así que comparar referencias marcaría como "editado"
 * cualquier campo simplemente aceptado.
 */
export function resolveProposalView(opts: {
  field: string;
  proposed: Record<string, Proposal>;
  accepted: Record<string, unknown>;
  /** El formateador de la pantalla (traduce ids de categoría a nombres, etc.). */
  format: (field: string, value: unknown) => string;
}): ProposalView {
  const { field, proposed, accepted, format } = opts;
  const isAccepted = field in accepted;
  const proposedValue = proposed[field]?.value;
  const effective = isAccepted ? accepted[field] : proposedValue;

  const aiText = format(field, proposedValue);
  const shownText = format(field, effective);

  return { effective, shownText, aiText, isAccepted, isEdited: isAccepted && shownText !== aiText };
}
