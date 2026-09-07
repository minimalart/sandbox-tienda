import { QuestionMarkCircle } from '@medusajs/icons';
import { Drawer, Heading, IconButton, Text } from '@medusajs/ui';
import { registerHelpDrawer } from '@minimalart/mercatto-plugin-runtime/admin';
import { helpFor } from '../../help';

/**
 * Botón de ayuda en el header de una página, y el drawer que abre.
 *
 * Es a dónde se muda el texto largo que hoy está apilado en la pantalla: las
 * `description` de varias oraciones, los `help` que se leen como párrafo y los
 * bloques numerados de "cómo funciona" incrustados en el JSX (el de
 * `brands/components/brand-csv-bulk.tsx` son ~75 líneas). Nada de eso se borra:
 * se corre un click, para que la pantalla vuelva a ser un formulario y no un
 * manual.
 *
 * Lo que NO va acá: los `InlineTip` condicionales —los que aparecen sólo cuando
 * pasa algo— y las ayudas cortas de campo. Esos son contextuales y accionables:
 * esconderlos detrás de un botón es empeorar la página, no adelgazarla. La regla
 * es "si es cierto SIEMPRE, va al drawer; si depende del estado, se queda".
 *
 * El contenido sale del slug, que es el mismo del directorio de la ruta y el del
 * markdown generado. Ese acuerdo de nombres —y no un registro paralelo— es lo
 * que evita la clase de bug que este PR viene arreglando: un registro aparte
 * nace desactualizado en la pantalla N+1.
 */

export type HelpDrawerProps = {
  /** Slug de la extensión: el directorio en `routes/`, la clave en `help/index.ts`. */
  slug: string;
};

export const HelpDrawer = ({ slug }: HelpDrawerProps) => {
  const help = helpFor(slug);

  // Sin ayuda escrita no hay botón. Durante la migración por tandas la mayoría
  // de las extensiones no va a tener entrada, y un botón que abre un drawer
  // vacío es peor que no tenerlo: promete algo y no lo cumple.
  if (!help) return null;

  return (
    <Drawer>
      <Drawer.Trigger asChild>
        <IconButton variant="transparent" size="small" aria-label={`Ayuda de ${help.title}`}>
          <QuestionMarkCircle className="text-ui-fg-muted" />
        </IconButton>
      </Drawer.Trigger>

      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{help.title}</Drawer.Title>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          <Text className="text-ui-fg-subtle">{help.summary}</Text>

          {help.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-y-2">
              <Heading level="h3">{section.heading}</Heading>

              {/* `body` viene con párrafos separados por línea en blanco, igual
                  que en el markdown generado. Se parte acá y no se renderiza
                  como un solo bloque para que el interlineado sea el mismo en
                  los dos lados: si el drawer los pegara en un párrafo, drawer y
                  doc mostrarían el mismo texto con distinta forma. */}
              {section.body
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim().replace(/\s*\n\s*/g, ' '))
                .filter(Boolean)
                .map((paragraph) => (
                  <Text key={paragraph} size="small" className="text-ui-fg-subtle">
                    {paragraph}
                  </Text>
                ))}

              {section.steps?.length ? (
                <ol className="flex list-decimal flex-col gap-y-1 pl-5">
                  {section.steps.map((step) => (
                    <li key={step}>
                      <Text size="small" className="text-ui-fg-subtle">
                        {step}
                      </Text>
                    </li>
                  ))}
                </ol>
              ) : null}

              {section.links?.length ? (
                <ul className="flex flex-col gap-y-1">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target={link.href.startsWith('http') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                        className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover txt-small"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};

// Registrar en el runtime contract: los plugins publicados
// (@minimalart/mercatto-plugin-runtime/admin) rendarizan el MISMO drawer vía
// el slot `HelpDrawer` sin importar este archivo (inalcanzable desde node_modules).
registerHelpDrawer(HelpDrawer);
