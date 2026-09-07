import type { LegalPage } from '@lib/data/legal-pages'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import { buildLegalToc } from '../anchors'
import LegalToc from './legalToc'

type LegalDocumentProps = {
  page: LegalPage
}

const Chevron = () => (
  <svg
    className='legal-chevron h-4 w-4 shrink-0 text-slate-400 transition-transform'
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    aria-hidden='true'
  >
    <path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
  </svg>
)

/**
 * Una página legal: breadcrumb, encabezado, índice lateral y secciones en acordeón.
 *
 * SERVER COMPONENT. Sólo el índice lateral es cliente, y sólo porque marca la sección
 * activa al scrollear (ver `legalToc.tsx`).
 *
 * ─── POR QUÉ `<details>` Y NO UN ACORDEÓN CON `useState` ───────────────────
 *
 * El storefront ya tiene uno con estado (`modules/contact/.../FaqAccordion.tsx`) y
 * acá NO se reusa, por tres cosas que en una página legal pesan más que en un FAQ:
 *
 *  1. **Ctrl+F.** El contenido de un `<details>` cerrado está en el DOM, y los
 *     navegadores lo encuentran y lo abren solos al buscar en la página. Un acordeón
 *     con `useState` no renderiza el panel cerrado: buscar "arrepentimiento" en los
 *     términos no encontraría nada. Es LA forma en que se usa un documento legal.
 *  2. **SEO.** Por lo mismo, el texto entero llega en el HTML inicial. Un acordeón
 *     con estado publicaría una página cuyo cuerpo Google no ve.
 *  3. **Teclado y lectores de pantalla** salen gratis y correctos, sin `aria-expanded`
 *     ni manejo de foco escrito a mano.
 *
 * El costo es que el estado abierto/cerrado no es de React: lo maneja el navegador, y
 * el índice lo abre tocando el DOM. Es un intercambio consciente.
 *
 * ─── POR QUÉ LOS ESTILOS DE APERTURA VIVEN EN `globals.css` ────────────────
 *
 * La rotación del chevron y el marcador del `<summary>` se resuelven con selectores
 * planos (`details[open] .legal-chevron`) en vez de la variante `group-open:` de
 * Tailwind: la versión declarada es `^3.0.23` y no hay forma de comprobar en este
 * repo cuál quedó instalada, así que depender de una variante que puede no existir
 * significa un chevron que nunca gira y nadie nota hasta producción.
 */
export default function LegalDocument({ page }: LegalDocumentProps) {
  const toc = buildLegalToc(page.sections)

  return (
    <section className='px-4 py-8 pb-16 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-6xl'>
        <nav aria-label='Breadcrumb' className='mb-6'>
          <ol className='flex flex-wrap items-center gap-1.5 text-slate-500 text-xs'>
            <li>
              <LocalizedClientLink href='/' className='hover:text-[--primary-color]'>
                Inicio
              </LocalizedClientLink>
            </li>
            <li aria-hidden='true'>›</li>
            {/*
              "Legales" NO es un link: no existe una ruta `/legal` (las tres páginas
              viven en `/legal/{slug}` y no hay índice). Un link a una URL que da 404
              es peor que un texto que no se puede clickear.
            */}
            <li>Legales</li>
            <li aria-hidden='true'>›</li>
            <li aria-current='page' className='font-medium text-slate-700'>
              {page.title}
            </li>
          </ol>
        </nav>

        <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-8'>
          <h1 className='max-w-2xl font-bold text-[#18324A] text-3xl sm:text-4xl'>
            {page.title}
          </h1>
          {page.updated_label && (
            <p className='shrink-0 text-slate-500 text-xs sm:text-right'>
              Última actualización:
              <br />
              <span className='text-slate-600'>{page.updated_label}</span>
            </p>
          )}
        </div>

        {page.intro && (
          <p className='mb-8 max-w-2xl text-[15px] text-slate-600 leading-7'>
            {page.intro}
          </p>
        )}

        <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]'>
          {/*
            El índice se esconde en mobile: apilado arriba del contenido serían cinco a
            nueve líneas de links antes del primer párrafo, y el acordeón ya cumple ahí
            la misma función (los títulos quedan a un scroll de distancia).
          */}
          <div className='hidden lg:block'>
            <LegalToc entries={toc} />
          </div>

          <div className='legal-accordion divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]'>
            {page.sections.map((section, index) => (
              <details
                key={toc[index].anchor}
                id={toc[index].anchor}
                // La primera abierta, como el diseño. Es `open` y no estado: el
                // navegador se encarga desde el HTML inicial, sin parpadeo.
                open={index === 0}
                // `scroll-mt` para que el header fijo no tape el título al que se
                // acaba de saltar desde el índice.
                className='scroll-mt-28'
              >
                <summary className='flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50'>
                  <h2 className='font-semibold text-[#18324A] text-[15px] leading-snug'>
                    <span className='mr-1.5 text-slate-400'>{index + 1}.</span>
                    {section.name}
                  </h2>
                  <Chevron />
                </summary>
                <div
                  className='legal-content px-5 pb-5'
                  // El HTML lo produce y lo sanea el backend al GUARDARSE
                  // (`sanitizeLegalHtml`), así que inyectarlo acá es seguro. Es la
                  // misma garantía que da el blog, movida del render a la escritura.
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
