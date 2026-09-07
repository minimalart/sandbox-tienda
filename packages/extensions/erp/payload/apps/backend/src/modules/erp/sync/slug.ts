/**
 * Slug para handles de categoría y de marca.
 *
 * Es una copia deliberada de `modules/demo-store/importers/util.ts`: ese módulo
 * NO existe en los proyectos generados (la extensión ERP se instala sola), así
 * que importarlo rompería el ERP en cualquier proyecto sin demo-store. El
 * algoritmo tiene que quedar igual para que los handles no cambien si un
 * catálogo se importó primero por demo-store y después lo toma el ERP.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}
