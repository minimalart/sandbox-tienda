import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LEGAL_PAGE_DEFAULTS } from '../../../../modules/store-config/legal/defaults.ts';
import { LEGAL_PAGE_SLUGS } from '../../../../modules/store-config/legal/pages.ts';
import { UpdateLegalPagesSchema } from './route.ts';

/**
 * El bug que este test retira para siempre: el editor de legales del backoffice
 * devolvía "No se pudo guardar: expected string, received null" en
 * `pages.<slug>.updated_label` y NINGUNA de las tres páginas se podía guardar.
 *
 * El mecanismo: el GET de esta ruta devuelve `updated_label: null` (las tres
 * defaults arrancan así, por diseño), el editor carga eso en su borrador y al
 * guardar manda el documento ENTERO de vuelta — con el `null` adentro. El schema
 * decía `z.string().optional()`, y `.optional()` acepta `undefined`, NO `null`.
 *
 * O sea que la ruta rechazaba exactamente lo que ella misma acababa de devolver.
 * Ése es el invariante que se testea acá, y es más general que el campo que falló:
 * lo que el GET DEVUELVE tiene que poder volver a ENTRAR por el POST.
 */
describe('UpdateLegalPagesSchema — lo que sale del GET tiene que poder volver a entrar', () => {
  for (const slug of LEGAL_PAGE_SLUGS) {
    it(`acepta el documento por defecto de "${slug}" tal cual lo devuelve el GET`, () => {
      const parsed = UpdateLegalPagesSchema.safeParse({
        pages: { [slug]: LEGAL_PAGE_DEFAULTS[slug] },
      });
      assert.equal(
        parsed.success,
        true,
        parsed.success ? '' : JSON.stringify(parsed.error.issues),
      );
    });
  }

  it('acepta las tres páginas juntas, que es el peor caso del editor', () => {
    const parsed = UpdateLegalPagesSchema.safeParse({ pages: LEGAL_PAGE_DEFAULTS });
    assert.equal(
      parsed.success,
      true,
      parsed.success ? '' : JSON.stringify(parsed.error.issues),
    );
  });
});

describe('UpdateLegalPagesSchema — los tres nullables', () => {
  // `LegalPageDoc` los declara `string | null`, así que los tres pueden llegar en
  // null. Hoy sólo `updated_label` sale null del GET; los otros dos tienen texto en
  // el default. El test cubre a los tres para que un default que mañana arranque en
  // null no vuelva a trabar el editor.
  for (const field of ['intro', 'updated_label', 'seo_description'] as const) {
    it(`acepta \`${field}: null\``, () => {
      const parsed = UpdateLegalPagesSchema.safeParse({
        pages: { conditions: { [field]: null } },
      });
      assert.equal(parsed.success, true);
    });

    it(`acepta \`${field}: ''\` (el operador vació el campo)`, () => {
      const parsed = UpdateLegalPagesSchema.safeParse({
        pages: { conditions: { [field]: '' } },
      });
      assert.equal(parsed.success, true);
    });
  }

  it('sigue rechazando un tipo que no es string ni null', () => {
    const parsed = UpdateLegalPagesSchema.safeParse({
      pages: { conditions: { updated_label: 42 } },
    });
    assert.equal(parsed.success, false);
  });

  it('`title` NO es nullable: nunca sale null del GET y una legal sin título no existe', () => {
    const parsed = UpdateLegalPagesSchema.safeParse({
      pages: { conditions: { title: null } },
    });
    assert.equal(parsed.success, false);
  });
});
