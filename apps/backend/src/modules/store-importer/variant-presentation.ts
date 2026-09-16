/** Source display values and local edits are independent from external SKU identity. */
export function variantPresentation(
  value: string,
  externalId: string,
  prior: any,
  priorValue: string | undefined,
  protectedFields: Set<string>
) {
  // Also sanitize queued records normalized before this fix.
  const suffix = ` · ${externalId}`;
  const sourceTitle = (value.endsWith(suffix) ? value.slice(0, -suffix.length) : value).trim();
  const label = !sourceTitle || sourceTitle === externalId ? 'Único' : sourceTitle;
  const previous = prior?.metadata?.catalog_imported_variant;
  const overrides = { ...prior?.metadata?.catalog_variant_overrides };
  const protectedVariant = new Set([
    ...protectedFields,
    ...(prior?.metadata?.catalog_protected_fields ?? []),
  ]);
  if (prior) {
    // Legacy imports always wrote the raw ID into Presentación and appended it
    // to the title. Any other legacy value may already be an operator correction.
    overrides.title ||= previous
      ? prior.title !== previous.title
      : !!prior.title && !prior.title.endsWith(suffix) && prior.title !== externalId;
    overrides.presentation ||= previous
      ? priorValue !== previous.presentation
      : priorValue !== undefined && priorValue !== externalId;
  }
  const legacyIdValue = !previous && priorValue === externalId;
  const protectedLabel = protectedVariant.has('presentation')
    ? prior?.metadata?.catalog_commercial?.presentation?.label?.trim()
    : undefined;
  const presentation = protectedLabel && protectedLabel !== externalId ? protectedLabel : label;
  const preservePresentation =
    !!prior && !legacyIdValue && (!!overrides.presentation || protectedVariant.has('presentation'));
  const savedTitle = prior?.title?.endsWith(suffix)
    ? prior.title.slice(0, -suffix.length).trim() || 'Único'
    : prior?.title === externalId
      ? 'Único'
      : prior?.title;
  return {
    title: prior && (overrides.title || protectedVariant.has('title')) ? savedTitle : label,
    presentation: priorValue !== undefined && preservePresentation ? priorValue : presentation,
    preservePresentation,
    overrides,
    label,
  };
}

/** Medusa requires unique option combinations. Ordinals distinguish otherwise
 * identical source labels without inventing content or exposing source IDs. */
export function allocatePresentations(
  entries: {
    id?: string;
    presentation: string;
    preservePresentation: boolean;
    previous?: string;
    previousImported?: string;
  }[],
  absentValues: string[] = []
) {
  const used = new Set(absentValues);
  const resolved = new Map<object, string>();
  for (const entry of entries.filter((v) => v.preservePresentation)) {
    // Do not silently rewrite a manually maintained value to fix a collision.
    if (used.has(entry.presentation))
      throw new Error('Presentaciones manuales duplicadas; revisá las opciones antes de importar.');
    used.add(entry.presentation);
    resolved.set(entry, entry.presentation);
  }
  // Keep previously assigned ordinal labels stable when the source order changes.
  for (const entry of entries.filter((v) => !v.preservePresentation)) {
    const previous = entry.previous;
    if (
      previous &&
      previous === entry.previousImported &&
      (previous === entry.presentation ||
        (previous.startsWith(`${entry.presentation} (`) &&
          /^\d+\)$/.test(previous.slice(entry.presentation.length + 2)))) &&
      !used.has(previous)
    ) {
      used.add(previous);
      resolved.set(entry, previous);
    }
  }
  for (const entry of entries) {
    if (resolved.has(entry)) continue;
    let candidate = entry.presentation;
    let ordinal = 2;
    while (used.has(candidate)) candidate = `${entry.presentation} (${ordinal++})`;
    used.add(candidate);
    resolved.set(entry, candidate);
  }
  return entries.map((entry) => resolved.get(entry)!);
}
