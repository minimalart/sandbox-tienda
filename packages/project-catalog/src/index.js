const catalog = require('./catalog.json');

const VALID_STATUSES = new Set(['ready', 'embedded', 'experimental', 'deprecated']);

/**
 * Hasta dónde llegó una extensión en su migración a multitienda. Son capacidades
 * INDEPENDIENTES, no niveles acumulativos: una extensión sin datos propios puede
 * tener `config` sin tener `data`.
 *
 *   data        — filtra su contenido por tienda (visibilidad).
 *   config      — su configuración se resuelve por tienda, no una por instancia.
 *   credentials — sus credenciales de terceros se resuelven por tienda.
 *
 * El campo se OMITE mientras la extensión no scopee nada. No lo marques "a ojo":
 * el valor tiene que ser defendible con código, porque un tag optimista hace que
 * alguien asuma aislamiento que no existe. Ver EXTENSIONES-MULTITIENDA.md.
 */
const VALID_MULTISTORE = new Set(['data', 'config', 'credentials']);

function validateCatalog(input = catalog) {
  const errors = [];
  const templates = new Map();
  const extensions = new Map();

  const validateMultistore = (entry) => {
    if (entry.multistore === undefined) return;
    if (!Array.isArray(entry.multistore) || entry.multistore.length === 0) {
      errors.push(`multistore must be a non-empty array for extension: ${entry.id} (omit the field if it scopes nothing)`);
      return;
    }
    const seen = new Set();
    for (const capability of entry.multistore) {
      if (!VALID_MULTISTORE.has(capability)) {
        errors.push(`Invalid multistore capability "${capability}" for extension: ${entry.id}`);
      }
      if (seen.has(capability)) errors.push(`Duplicate multistore capability "${capability}" for extension: ${entry.id}`);
      seen.add(capability);
    }
  };

  const validateMetadata = (entry, kind) => {
    if (!entry.description || !String(entry.description).trim()) errors.push(`Missing description for ${kind}: ${entry.id}`);
    if (!entry.category || !String(entry.category).trim()) errors.push(`Missing category for ${kind}: ${entry.id}`);
    if (entry.screenshot && !String(entry.screenshot).startsWith('https://')) errors.push(`Screenshot must be an https URL for ${kind}: ${entry.id}`);
  };

  for (const template of input.templates || []) {
    if (!template.id || templates.has(template.id)) errors.push(`Invalid or duplicate template: ${template.id}`);
    if (!VALID_STATUSES.has(template.status)) errors.push(`Invalid template status: ${template.id}`);
    validateMetadata(template, 'template');
    templates.set(template.id, template);
  }

  for (const extension of input.extensions || []) {
    if (!extension.id || extensions.has(extension.id)) errors.push(`Invalid or duplicate extension: ${extension.id}`);
    if (!VALID_STATUSES.has(extension.status)) errors.push(`Invalid extension status: ${extension.id}`);
    validateMetadata(extension, 'extension');
    validateMultistore(extension);
    extensions.set(extension.id, extension);
  }

  for (const extension of extensions.values()) {
    for (const dependency of extension.dependencies || []) {
      if (!extensions.has(dependency)) errors.push(`${extension.id} requires missing extension ${dependency}`);
    }
  }
  for (const template of templates.values()) {
    for (const dependency of template.dependencies || []) {
      if (!extensions.has(dependency)) errors.push(`${template.id} requires missing extension ${dependency}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) {
      errors.push(`Dependency cycle detected at ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of extensions.get(id)?.dependencies || []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of extensions.keys()) visit(id);

  return { valid: errors.length === 0, errors };
}

function resolveProjectSelection({ template, extensions = [] }) {
  const selectedTemplate = catalog.templates.find((item) => item.id === template);
  if (!selectedTemplate) throw new Error(`Unknown template: ${template}`);
  if (selectedTemplate.status !== 'ready') throw new Error(`Template ${template} is not ready`);

  const byId = new Map(catalog.extensions.map((item) => [item.id, item]));
  const resolved = new Set(
    catalog.extensions.filter((item) => item.required).map((item) => item.id),
  );
  const add = (id) => {
    // Los blueprints anteriores conservan compatibilidad; Tiendas ahora incluye el importador.
    if (id === 'store-importer') id = 'multistore';
    const extension = byId.get(id);
    if (!extension) throw new Error(`Unknown extension: ${id}`);
    if (extension.status === 'experimental' || extension.status === 'deprecated') {
      throw new Error(`Extension ${id} is not installable (${extension.status})`);
    }
    if (resolved.has(id)) return;
    for (const dependency of extension.dependencies || []) add(dependency);
    resolved.add(id);
  };
  for (const id of selectedTemplate.dependencies || []) add(id);
  for (const id of extensions) add(id);

  return {
    template: selectedTemplate,
    extensions: [...resolved].map((id) => byId.get(id)),
  };
}

module.exports = { catalog, resolveProjectSelection, validateCatalog };
