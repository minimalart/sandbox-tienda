/**
 * Re-exports from the events catalog — backward-compatible shim.
 * The canonical source of truth is `src/admin/lib/email-events-catalog.ts`.
 *
 * Nothing new should import this file. Prefer importing from the catalog
 * directly for all new code.
 */
export type {
  EmailAudience,
  EmailEvent,
  EmailEventTemplate,
  EmailKeyOption as EmailEventOption,
} from './email-events-catalog';

export {
  EMAIL_EVENTS,
  EMAIL_TEMPLATE_KEY_OPTIONS as EMAIL_EVENT_OPTIONS,
  findByKey,
  getEventTemplatesForKey,
  isDualAudience,
  eventIdForKey,
  audienceForKey,
} from './email-events-catalog';

// Legacy group labels — no longer used by the combobox but kept so any
// forgotten consumer doesn't break the compile.
export type EmailEventGroup = 'app' | 'medusa';
export const EMAIL_EVENT_GROUP_LABELS: Record<EmailEventGroup, string> = {
  app: 'Eventos de la app',
  medusa: 'Eventos de Medusa',
};
