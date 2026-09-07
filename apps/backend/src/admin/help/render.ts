import type { ExtensionHelp } from './types';

/**
 * `ExtensionHelp` → markdown. Función PURA y sin `node:*` a propósito: la usan
 * el script generador (`scripts/generate-extension-docs.ts`, que sí toca disco)
 * y el test de sincronía (`docs-sync.test.ts`, que compara contra disco). Si la
 * lógica de render viviera dentro del script, el test tendría que ejecutarlo
 * como subproceso y compararía el generador contra sí mismo.
 *
 * El formato es deliberadamente aburrido —encabezados, párrafos, listas— porque
 * el markdown es un ARTEFACTO: nadie lo edita a mano, y todo lo que agregue
 * variabilidad acá es una forma más de que el test falle por ruido en vez de por
 * contenido desactualizado.
 */

/** Aviso al principio del archivo. Editar el `.md` a mano rompe el test, no el build. */
const BANNER = [
  '<!--',
  '  ARCHIVO GENERADO — no editar a mano.',
  '  Fuente: apps/backend/src/admin/help/<extension>.ts',
  '  Regenerar: cd apps/backend && npm run docs:extensions',
  '  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.',
  '-->',
].join('\n');

export const renderExtensionDoc = (help: ExtensionHelp): string => {
  const lines: string[] = [BANNER, '', `# ${help.title}`, '', help.summary];

  for (const section of help.sections) {
    lines.push('', `## ${section.heading}`, '');

    // `body` puede traer varios párrafos separados por línea en blanco. Se
    // normaliza el interlineado para que el markdown no herede el sangrado del
    // template literal del módulo fuente.
    lines.push(
      section.body
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim().replace(/\s*\n\s*/g, ' '))
        .filter(Boolean)
        .join('\n\n'),
    );

    if (section.steps?.length) {
      lines.push('');
      section.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    }

    if (section.links?.length) {
      lines.push('');
      for (const link of section.links) lines.push(`- [${link.label}](${link.href})`);
    }
  }

  // Newline final: sin esto, todo editor que guarde el archivo lo agrega y el
  // test empieza a fallar por un byte que nadie escribió.
  return `${lines.join('\n')}\n`;
};
