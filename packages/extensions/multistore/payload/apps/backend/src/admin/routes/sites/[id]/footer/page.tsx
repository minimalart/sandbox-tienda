import {
  Alert,
  Button,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  Toaster,
  Tooltip,
  toast,
} from '@medusajs/ui';
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from '@medusajs/icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDemoStore, useUpdateDemoStore } from '../../../../hooks/api/demo-stores';
import { useStorefrontBase } from '../../../../hooks/use-storefront-base';
import { buildPublicUrlFrom, formatPublicUrlFrom, SITE_HOST_SUFFIX } from '../../lib';

/** Los íconos que el storefront sabe dibujar (`SocialLink.icon`). */
const SOCIAL_ICONS = [
  'instagram',
  'facebook',
  'twitter',
  'linkedin',
  'youtube',
  'tiktok',
] as const;

type SocialRow = { name: string; href: string; icon?: string };
type LegalRow = { name: string; href: string };

type FooterForm = {
  description: string;
  social: SocialRow[];
  legal: LegalRow[];
  newsletterTitle: string;
  newsletterPlaceholder: string;
  newsletterButton: string;
  copyright: string;
};

const EMPTY: FooterForm = {
  description: '',
  social: [],
  legal: [],
  newsletterTitle: '',
  newsletterPlaceholder: '',
  newsletterButton: '',
  copyright: '',
};

/** Mueve un elemento del array. Devuelve el MISMO array si el destino no existe. */
const move = <T,>(items: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const trimmed = (value: string): string | undefined => {
  const t = value.trim();
  return t === '' ? undefined : t;
};

/**
 * Lista de filas ordenables (redes, legales).
 *
 * A NIVEL DE MÓDULO a propósito. Definida dentro del componente, React la ve como
 * un TIPO nuevo en cada render, desmonta el subárbol y lo vuelve a montar: el input
 * que se está tipeando pierde el foco en cada tecla. Es el bug clásico de declarar
 * componentes en el render, y acá se nota enseguida porque adentro hay inputs.
 */
function Rows<T>({
  label,
  help,
  rows,
  onChange,
  empty,
  render,
}: {
  label: string;
  help: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  empty: () => T;
  render: (row: T, set: (patch: Partial<T>) => void) => ReactNode;
}) {
  return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <Label size="small" weight="plus">
              {label}
            </Label>
            <Text size="xsmall" className="text-ui-fg-muted">
              {help}
            </Text>
          </div>
          <Button
            type="button"
            size="small"
            variant="secondary"
            onClick={() => onChange([...rows, empty()])}
          >
            <Plus />
            Agregar
          </Button>
        </div>
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            {render(row, (p) =>
              onChange(rows.map((r, i) => (i === index ? { ...r, ...p } : r))),
            )}
            <Tooltip content="Subir">
              <IconButton
                type="button"
                size="small"
                variant="transparent"
                disabled={index === 0}
                onClick={() => onChange(move(rows, index, index - 1))}
              >
                <ArrowUpMini />
              </IconButton>
            </Tooltip>
            <Tooltip content="Bajar">
              <IconButton
                type="button"
                size="small"
                variant="transparent"
                disabled={index === rows.length - 1}
                onClick={() => onChange(move(rows, index, index + 1))}
              >
                <ArrowDownMini />
              </IconButton>
            </Tooltip>
            <Tooltip content="Quitar">
              <IconButton
                type="button"
                size="small"
                variant="transparent"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                <Trash />
              </IconButton>
            </Tooltip>
          </div>
        ))}
      </div>
  );
}

/**
 * "Personalizar footer" — el footer de UNA tienda.
 *
 * Consume: GET/POST /admin/sites/{id} (`content_config`)
 *
 * ─── POR QUÉ ES UN FORMULARIO Y NO PUCK ────────────────────────────────────
 *
 * La home usa Puck porque es una composición LIBRE: el operador arrastra secciones
 * en cualquier orden. El footer no es eso — es un layout FIJO (dos variantes,
 * escritorio y mobile) con cinco slots que el storefront ya tiene tipados en
 * `FooterConfig`: descripción, newsletter, contacto, redes y legales. Con Puck el
 * operador podría arrastrar un carrusel de productos al footer, y el footer dejaría
 * de ser el mismo en todo el sitio.
 *
 * ─── POR QUÉ MANDA `content_config` COMPLETO ───────────────────────────────
 *
 * `POST /admin/sites/{id}` termina en `service.updateDemoStores`, que REEMPLAZA la
 * columna JSON entera. Mandar `{ content_config: { footer } }` le borraría a la
 * tienda `sections`, `sucursales`, `shoppingList`, los hints de búsqueda y todo lo
 * demás. Por eso el guardado hace spread del `content_config` que vino del server y
 * sólo pisa `footer` — así lo que esta pantalla no conoce sobrevive igual, incluso
 * si mañana alguien agrega una clave nueva.
 *
 * ─── EL CONTACTO NO SE EDITA ACÁ ───────────────────────────────────────────
 *
 * Teléfono, mail, dirección y horario viven en `content_config.contact` y los
 * muestra también `/contact`: NO son datos del footer. Hasta DESDEELSUR-18 se
 * editaban en esta pantalla Y en la ficha de la tienda, y cada guardado
 * reconstruía el objeto entero, así que la última pantalla en guardar ganaba.
 * Ahora el único dueño es la ficha, y acá `contact` ni se toca — viaja en el
 * spread de `current`.
 *
 * ─── Y POR QUÉ EL FOOTER SE MANDA ENTERO ───────────────────────────────────
 *
 * `assets.footer` se mergea shallow POR CLAVE en el storefront: un `footer` parcial
 * le borra al sitio las sub-claves que no viajan. Ya pasó — editar la descripción
 * publicaba un teléfono inventado (PR #830). Emitir el objeto completo desde acá es
 * lo que desactiva esa trampa en el origen, en vez de depender de la excepción de
 * merge que tiene `mergeMainTenant`.
 */
const SiteFooterEditor = () => {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { data, isLoading } = useDemoStore(id);
  const demo = data?.demo_store;
  const updateMut = useUpdateDemoStore(id);
  const storefrontBase = useStorefrontBase();

  const [form, setForm] = useState<FooterForm>(EMPTY);

  /** El server gana cada vez que llega: al cargar y después de guardar. */
  useEffect(() => {
    if (!demo) return;
    const cfg = (demo.content_config ?? {}) as Record<string, any>;
    const footer = cfg.footer ?? {};
    setForm({
      description: footer.description ?? '',
      social: Array.isArray(footer.social) ? footer.social : [],
      legal: Array.isArray(footer.legal) ? footer.legal : [],
      newsletterTitle: footer.newsletter?.title ?? '',
      newsletterPlaceholder: footer.newsletter?.placeholder ?? '',
      newsletterButton: footer.newsletter?.buttonText ?? '',
      copyright: footer.copyright ?? '',
    });
  }, [demo]);

  /**
   * ¿Esta tienda tiene algo de footer propio? Si no, el storefront publica el del
   * template (o el de `defaultConfig`), y conviene decirlo: es la diferencia entre
   * "el footer se ve así porque alguien lo configuró" y "se ve así porque nadie lo
   * tocó todavía".
   */
  const isPristine = useMemo(() => {
    const cfg = (demo?.content_config ?? {}) as Record<string, any>;
    return !cfg.footer;
  }, [demo]);

  const patch = (p: Partial<FooterForm>) => setForm((prev) => ({ ...prev, ...p }));

  const handleSave = async () => {
    if (!demo) return;
    // Spread de lo que vino del server: ver el encabezado de este archivo.
    const current = (demo.content_config ?? {}) as Record<string, unknown>;

    const social = form.social
      .filter((s) => s.name.trim() && s.href.trim())
      .map((s) => ({
        name: s.name.trim(),
        href: s.href.trim(),
        ...(s.icon ? { icon: s.icon } : {}),
      }));
    const legal = form.legal
      .filter((l) => l.name.trim() && l.href.trim())
      .map((l) => ({ name: l.name.trim(), href: l.href.trim() }));

    const newsletter = {
      ...(trimmed(form.newsletterTitle) ? { title: form.newsletterTitle.trim() } : {}),
      ...(trimmed(form.newsletterPlaceholder)
        ? { placeholder: form.newsletterPlaceholder.trim() }
        : {}),
      ...(trimmed(form.newsletterButton)
        ? { buttonText: form.newsletterButton.trim() }
        : {}),
    };

    const footer = {
      ...(trimmed(form.description) ? { description: form.description.trim() } : {}),
      ...(social.length ? { social } : {}),
      ...(legal.length ? { legal } : {}),
      ...(Object.keys(newsletter).length ? { newsletter } : {}),
      ...(trimmed(form.copyright) ? { copyright: form.copyright.trim() } : {}),
    };

    try {
      await updateMut.mutateAsync({
        content_config: {
          ...current,
          // Vacío = se BORRA la clave, no se guarda un objeto vacío: emitir
          // `footer: {}` haría que gane entero sobre el del template y le dejaría
          // el footer en blanco a la tienda.
          ...(Object.keys(footer).length ? { footer } : { footer: undefined }),
        } as any,
      });
      toast.success('Footer guardado');
    } catch (error: any) {
      toast.error(`No se pudo guardar: ${error?.message ?? ''}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Text className="text-ui-fg-subtle">…</Text>
      </div>
    );
  }

  if (!demo) {
    return (
      <div className="flex flex-col items-center gap-3 p-12">
        <Text className="text-ui-fg-subtle">Tienda no encontrada</Text>
        <Button size="small" variant="secondary" onClick={() => navigate('/sites')}>
          Volver
        </Button>
      </div>
    );
  }


  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between border-ui-border-base border-b bg-ui-bg-base px-4 py-2">
        <div className="flex items-center gap-3">
          <Button size="small" variant="transparent" onClick={() => navigate('/sites')}>
            ← Volver
          </Button>
          <Heading level="h2" className="text-base">
            {demo.name}
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {formatPublicUrlFrom(demo, {
              baseUrl: storefrontBase,
              hostSuffix: SITE_HOST_SUFFIX,
            })}
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={buildPublicUrlFrom(demo, {
              baseUrl: storefrontBase,
              hostSuffix: SITE_HOST_SUFFIX,
            })}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-ui-fg-interactive"
          >
            Vista previa ↗
          </a>
          <Button size="small" onClick={handleSave} isLoading={updateMut.isPending}>
            Guardar cambios
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
          {isPristine && (
            <Alert variant="info">
              Esta tienda todavía no tiene footer propio: se publica el de su
              plantilla. Lo que dejes vacío acá sigue cayendo a ese default.
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label size="small" weight="plus" htmlFor="footer-description">
              Descripción
            </Label>
            <Textarea
              id="footer-description"
              rows={3}
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              El párrafo bajo el logo. No es la descripción de SEO: esa se edita en la
              ficha de la tienda y alimenta el `meta description`.
            </Text>
          </div>

          {/*
            El contacto se editaba acá hasta DESDEELSUR-18. No es un dato del
            footer: lo muestra también /contact, y tenerlo en dos pantallas que
            reconstruyen el objeto entero hacía que ganara la última en guardar.
            Queda el puntero porque el campo desaparece de esta pantalla.
          */}
          <div className="flex flex-col gap-0.5 rounded-lg border border-ui-border-base p-4">
            <Label size="small" weight="plus">
              Atención al cliente
            </Label>
            <Text size="xsmall" className="text-ui-fg-muted">
              El teléfono, el mail, la dirección y el horario que muestra el footer se
              editan en la ficha de la tienda, no acá: son los mismos datos que usa la
              página de contacto. Lo que quede vacío no se muestra — el footer ya no
              inventa un teléfono.
            </Text>
          </div>

          <Rows<SocialRow>
            label="Redes sociales"
            help="El ícono define qué logo dibuja el storefront. Una fila sin nombre o sin URL no se publica."
            rows={form.social}
            onChange={(social) => patch({ social })}
            empty={() => ({ name: '', href: '', icon: 'instagram' })}
            render={(row, set) => (
              <>
                <Input
                  placeholder="Instagram"
                  className="flex-1"
                  value={row.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
                <Input
                  placeholder="https://instagram.com/…"
                  className="flex-[2]"
                  value={row.href}
                  onChange={(e) => set({ href: e.target.value })}
                />
                <Select
                  value={row.icon ?? ''}
                  onValueChange={(icon) => set({ icon } as Partial<SocialRow>)}
                >
                  <Select.Trigger className="w-36">
                    <Select.Value placeholder="Ícono" />
                  </Select.Trigger>
                  <Select.Content>
                    {SOCIAL_ICONS.map((icon) => (
                      <Select.Item key={icon} value={icon}>
                        {icon}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </>
            )}
          />

          <Rows<LegalRow>
            label="Legales"
            help="Los links de la columna Legales. El destino tiene que existir bajo /legal — los textos de esas páginas se editan en Preferencias → Legales."
            rows={form.legal}
            onChange={(legal) => patch({ legal })}
            empty={() => ({ name: '', href: '/legal/legals' })}
            render={(row, set) => (
              <>
                <Input
                  placeholder="Política de privacidad"
                  className="flex-1"
                  value={row.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
                <Input
                  placeholder="/legal/legals"
                  className="flex-1"
                  value={row.href}
                  onChange={(e) => set({ href: e.target.value })}
                />
              </>
            )}
          />

          <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
            <Label size="small" weight="plus">
              Newsletter
            </Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                placeholder="Título"
                value={form.newsletterTitle}
                onChange={(e) => patch({ newsletterTitle: e.target.value })}
              />
              <Input
                placeholder="Placeholder del campo"
                value={form.newsletterPlaceholder}
                onChange={(e) => patch({ newsletterPlaceholder: e.target.value })}
              />
              <Input
                placeholder="Texto del botón"
                value={form.newsletterButton}
                onChange={(e) => patch({ newsletterButton: e.target.value })}
              />
            </div>
            <Text size="xsmall" className="text-ui-fg-muted">
              Vacío = los textos por defecto del storefront. A diferencia del
              teléfono, acá el default es copy de interfaz y no afirma nada sobre el
              negocio, así que se puede dejar.
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Label size="small" weight="plus" htmlFor="footer-copyright">
              Copyright
            </Label>
            <Input
              id="footer-copyright"
              placeholder="NOMBRE © {year} Todos los derechos reservados."
              value={form.copyright}
              onChange={(e) => patch({ copyright: e.target.value })}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              {'`{year}` se reemplaza por el año en curso al renderizar, así que el '}
              texto no envejece. Vacío = la línea de siempre con el nombre de la
              tienda.
            </Text>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
};

export default SiteFooterEditor;
