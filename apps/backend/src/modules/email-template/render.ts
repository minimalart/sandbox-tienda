import Handlebars from 'handlebars';

/**
 * Pure Handlebars renderer for email templates. Deliberately dependency-free
 * (no DI) so both the SendGrid notification provider and the admin preview/test
 * routes can import it directly.
 *
 * - Variables ({{var}}) are HTML-escaped by default — injected data can't break
 *   out of the markup. Authors write raw HTML directly in the template, and may
 *   use {{{var}}} to inject pre-trusted HTML on purpose.
 * - Loops/conditionals ({{#each items}}, {{#if x}}) are supported so templates
 *   with line items (order confirmation, etc.) render correctly.
 */
export type RenderEmailInput = {
  subject: string;
  html: string;
  data?: Record<string, unknown>;
};

export type RenderEmailOutput = {
  subject: string;
  html: string;
};

// Compiled-template cache keyed by source string. Templates rarely change, so
// this avoids recompiling on every send.
const compileCache = new Map<string, Handlebars.TemplateDelegate>();

function compile(source: string): Handlebars.TemplateDelegate {
  let fn = compileCache.get(source);
  if (!fn) {
    fn = Handlebars.compile(source ?? '', { noEscape: false });
    compileCache.set(source, fn);
  }
  return fn;
}

export function renderEmailTemplate({
  subject,
  html,
  data = {},
}: RenderEmailInput): RenderEmailOutput {
  return {
    subject: compile(subject ?? '')(data),
    html: compile(html ?? '')(data),
  };
}
