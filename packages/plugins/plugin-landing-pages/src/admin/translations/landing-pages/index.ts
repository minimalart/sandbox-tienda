import type { i18n as I18nInstance } from 'i18next';

const LANDING_PAGES_NAMESPACE = 'landingPages';
let registered = false;

export const en = {
  TITLE: 'Landings',
  SUBTITLE: 'Build and manage visual landing pages.',
  CREATE_BUTTON: 'Create',
  EDIT: 'Edit',
  DUPLICATE: 'Duplicate',
  PUBLISH: 'Publish',
  UNPUBLISH: 'Unpublish',
  ARCHIVE: 'Archive',
  DELETE: 'Delete',
  EMPTY_STATE: 'No landings yet. Create your first one to get started.',

  COLUMN_TITLE: 'Title',
  COLUMN_SLUG: 'Slug',
  COLUMN_STATUS: 'Status',
  COLUMN_LOCALE: 'Locale',
  COLUMN_UPDATED: 'Updated',
  COLUMN_ACTIONS: 'Actions',

  STATUS_DRAFT: 'Draft',
  STATUS_PUBLISHED: 'Published',
  STATUS_ARCHIVED: 'Archived',

  CREATE_TITLE: 'Create landing',
  EDIT_TITLE: 'Edit landing',
  FIELD_TITLE: 'Title *',
  FIELD_TITLE_PLACEHOLDER: 'Landing title',
  FIELD_SLUG: 'Slug',
  FIELD_SLUG_PLACEHOLDER: 'my-landing',
  FIELD_SLUG_HELP: 'URL identifier. Generated from the title if left empty.',
  FIELD_STATUS: 'Status',
  FIELD_LOCALE: 'Locale',
  FIELD_LOCALE_PLACEHOLDER: 'es-AR',
  FIELD_SEO_TITLE: 'SEO title',
  FIELD_SEO_DESCRIPTION: 'SEO description',
  CONTENT_EDITOR_HINT:
    'The visual content editor (Puck) opens from “Edit content”. Here you manage the page settings.',
  EDIT_CONTENT: 'Edit content',
  SAVE: 'Save',
  CANCEL: 'Cancel',

  CREATE_SUCCESS: 'Landing created',
  UPDATE_SUCCESS: 'Landing updated',
  DELETE_SUCCESS: 'Landing deleted',
  PUBLISH_SUCCESS: 'Landing published',
  UNPUBLISH_SUCCESS: 'Landing moved to draft',
  DUPLICATE_SUCCESS: 'Landing duplicated',
  ACTION_ERROR: 'Action failed: {{msg}}',
  VALIDATION_TITLE_REQUIRED: 'Title is required',
  DELETE_CONFIRM: 'Delete this landing? This cannot be undone.',
};

export const es = {
  TITLE: 'Landings',
  SUBTITLE: 'Creá y gestioná landing pages visuales.',
  CREATE_BUTTON: 'Crear',
  EDIT: 'Editar',
  DUPLICATE: 'Duplicar',
  PUBLISH: 'Publicar',
  UNPUBLISH: 'Despublicar',
  ARCHIVE: 'Archivar',
  DELETE: 'Eliminar',
  EMPTY_STATE: 'Todavía no hay landings. Creá la primera para empezar.',

  COLUMN_TITLE: 'Título',
  COLUMN_SLUG: 'Slug',
  COLUMN_STATUS: 'Estado',
  COLUMN_LOCALE: 'Idioma',
  COLUMN_UPDATED: 'Actualizada',
  COLUMN_ACTIONS: 'Acciones',

  STATUS_DRAFT: 'Borrador',
  STATUS_PUBLISHED: 'Publicada',
  STATUS_ARCHIVED: 'Archivada',

  CREATE_TITLE: 'Crear landing',
  EDIT_TITLE: 'Editar landing',
  FIELD_TITLE: 'Título *',
  FIELD_TITLE_PLACEHOLDER: 'Título de la landing',
  FIELD_SLUG: 'Slug',
  FIELD_SLUG_PLACEHOLDER: 'mi-landing',
  FIELD_SLUG_HELP: 'Identificador de URL. Se genera del título si lo dejás vacío.',
  FIELD_STATUS: 'Estado',
  FIELD_LOCALE: 'Idioma',
  FIELD_LOCALE_PLACEHOLDER: 'es-AR',
  FIELD_SEO_TITLE: 'Título SEO',
  FIELD_SEO_DESCRIPTION: 'Descripción SEO',
  CONTENT_EDITOR_HINT:
    'El editor visual de contenido (Puck) se abre desde “Editar contenido”. Acá gestionás la configuración de la página.',
  EDIT_CONTENT: 'Editar contenido',
  SAVE: 'Guardar',
  CANCEL: 'Cancelar',

  CREATE_SUCCESS: 'Landing creada',
  UPDATE_SUCCESS: 'Landing actualizada',
  DELETE_SUCCESS: 'Landing eliminada',
  PUBLISH_SUCCESS: 'Landing publicada',
  UNPUBLISH_SUCCESS: 'Landing pasada a borrador',
  DUPLICATE_SUCCESS: 'Landing duplicada',
  ACTION_ERROR: 'La acción falló: {{msg}}',
  VALIDATION_TITLE_REQUIRED: 'El título es obligatorio',
  DELETE_CONFIRM: '¿Eliminar esta landing? No se puede deshacer.',
};

/**
 * Registers the Landings translation bundles on the live admin i18n instance.
 * Pass the `i18n` from `useTranslation()` (see banners for the rationale).
 */
export const registerLandingPagesTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }
  i18n.addResourceBundle('en', LANDING_PAGES_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', LANDING_PAGES_NAMESPACE, es, true, true);
  void i18n.loadNamespaces(LANDING_PAGES_NAMESPACE);
  registered = true;
};
