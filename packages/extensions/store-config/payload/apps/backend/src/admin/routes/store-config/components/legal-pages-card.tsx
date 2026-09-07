import {
  Alert,
  Badge,
  Button,
  Heading,
  IconButton,
  Input,
  Label,
  Text,
  Textarea,
  Tooltip,
  toast,
} from '@medusajs/ui';
import { ArrowDownMini, ArrowUpMini, Plus, Trash } from '@medusajs/icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LegalHtmlEditor } from '../../../components/store-config/legal-html-editor';
import {
  useLegalPages,
  useUpdateLegalPages,
  type LegalPageDoc,
  type LegalSection,
} from '../../../hooks/api/legal-pages';
import {
  LEGAL_PAGE_PATHS,
  LEGAL_PAGE_SLUGS,
  type LegalPageSlug,
} from '../../../../modules/store-config/legal/pages';

type Drafts = Partial<Record<LegalPageSlug, LegalPageDoc>>;

/**
 * Id de una sección nueva.
 *
 * `crypto.randomUUID` no existe en contextos no seguros (un admin servido por http en
 * una IP de red local, que es como se prueba en un cliente), así que el fallback no es
 * decorativo: sin él, agregar una sección tira y el botón "no hace nada". Sólo tiene
 * que ser único DENTRO del documento — no se publica en ninguna URL.
 */
const newSectionId = (): string => {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `s-${Math.random().toString(36).slice(2, 10)}`;
};

/** Mueve un elemento del array. Devuelve el MISMO array si el destino no existe. */
const move = <T,>(items: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * Card de textos legales — el título, la bajada, la fecha de última actualización y
 * las SECCIONES de las tres páginas `/legal/*` del storefront.
 *
 * Consume: GET/POST /admin/store-config/legal-pages
 *
 * El `Alert` de "texto de ejemplo" es la mitad del valor de esta pantalla. Toda tienda
 * del boilerplate arranca publicando los legales de muestra —con "La Empresa S.A." y
 * "www.ejemplo.com.ar" adentro— y hasta ahora no había ningún lugar donde eso se
 * viera: el texto estaba hardcodeado en el storefront y se leía como si fuera propio.
 * Poder editarlo sin decir que hay algo que editar habría dejado el mismo problema con
 * una pantalla más.
 */
export function LegalPagesCard() {
  const { t } = useTranslation('storeConfig');
  const { data, isPending } = useLegalPages();
  const { mutateAsync: update, isPending: saving } = useUpdateLegalPages();

  const [slug, setSlug] = useState<LegalPageSlug>('legals');
  const [drafts, setDrafts] = useState<Drafts>({});

  /**
   * El server gana cada vez que llega: al cargar y después de guardar (la mutación
   * invalida la query). Mientras el operador escribe, `data` no cambia de identidad,
   * así que esto no le pisa el borrador.
   */
  useEffect(() => {
    if (data?.legal_pages) setDrafts(data.legal_pages);
  }, [data]);

  const draft = drafts[slug];
  const saved = data?.legal_pages?.[slug];
  const isSample = data?.customized?.[slug] === false;

  const dirty = useMemo(() => {
    if (!draft || !saved) return false;
    return JSON.stringify(draft) !== JSON.stringify(saved);
  }, [draft, saved]);

  const patchDraft = (patch: Partial<LegalPageDoc>) =>
    setDrafts((prev) => {
      const current = prev[slug];
      if (!current) return prev;
      return { ...prev, [slug]: { ...current, ...patch } };
    });

  const patchSections = (fn: (sections: LegalSection[]) => LegalSection[]) =>
    setDrafts((prev) => {
      const current = prev[slug];
      if (!current) return prev;
      return { ...prev, [slug]: { ...current, sections: fn(current.sections) } };
    });

  const handleSave = async () => {
    if (!draft) return;
    try {
      // Se manda SÓLO la página abierta. El backend mergea por página sobre lo
      // guardado, así que enviar las tres re-escribiría como "propio" el texto de
      // ejemplo de las otras dos y apagaría su aviso.
      await update({ [slug]: draft });
      toast.success(t('LEGAL_SAVED'));
    } catch (e: any) {
      toast.error(t('LEGAL_SAVE_ERROR', { msg: e?.message ?? '' }));
    }
  };

  const handleReset = async () => {
    try {
      // `sections: []` NO publica una página en blanco: el service lo lee como "borrá
      // lo guardado" y la página vuelve al texto por defecto. Ver `normalizeStoredDoc`.
      await update({ [slug]: { sections: [] } });
      toast.success(t('LEGAL_RESET_DONE'));
    } catch (e: any) {
      toast.error(t('LEGAL_SAVE_ERROR', { msg: e?.message ?? '' }));
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-ui-border-base p-6">
      <div className="flex flex-col gap-1">
        <Heading level="h2">{t('LEGAL_TITLE')}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t('LEGAL_DESCRIPTION')}
        </Text>
      </div>

      {/* Selector de página. Botones y no `Tabs` porque esta card ya vive DENTRO de
          una pestaña de Preferencias: dos niveles de `Tabs.List` anidados se leen como
          un solo grupo y el operador pierde de vista en cuál de los dos está. */}
      <div className="flex flex-wrap items-center gap-2">
        {LEGAL_PAGE_SLUGS.map((s) => (
          <Button
            key={s}
            type="button"
            size="small"
            variant={s === slug ? 'primary' : 'secondary'}
            onClick={() => setSlug(s)}
          >
            <span className="flex items-center gap-2">
              {t(`LEGAL_PAGE_${s}`)}
              {data?.customized?.[s] === false && (
                <Badge size="2xsmall" color="orange">
                  {t('LEGAL_BADGE_SAMPLE')}
                </Badge>
              )}
            </span>
          </Button>
        ))}
      </div>

      {isPending || !draft ? (
        <Text size="small" className="text-ui-fg-subtle">
          {t('LEGAL_LOADING')}
        </Text>
      ) : (
        <>
          {isSample && <Alert variant="warning">{t('LEGAL_SAMPLE_WARNING')}</Alert>}

          {/* ── Encabezado del documento ─────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus" htmlFor="legal-title">
                {t('LEGAL_FIELD_TITLE')}
              </Label>
              <Input
                id="legal-title"
                value={draft.title}
                onChange={(e) => patchDraft({ title: e.target.value })}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                {/* La ruta va como texto y no como link: armar la URL pública de la
                    tienda activa vive en la extensión del gestor de sitios, y esta card
                    no puede importar de ahí sin atarle `store-config` a esa extensión. */}
                {t('LEGAL_FIELD_TITLE_HELP', { path: LEGAL_PAGE_PATHS[slug] })}
              </Text>
            </div>

            <div className="flex flex-col gap-2">
              <Label size="small" weight="plus" htmlFor="legal-updated">
                {t('LEGAL_FIELD_UPDATED')}
              </Label>
              <Input
                id="legal-updated"
                placeholder={t('LEGAL_FIELD_UPDATED_PLACEHOLDER')}
                value={draft.updated_label ?? ''}
                onChange={(e) => patchDraft({ updated_label: e.target.value })}
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('LEGAL_FIELD_UPDATED_HELP')}
              </Text>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label size="small" weight="plus" htmlFor="legal-intro">
              {t('LEGAL_FIELD_INTRO')}
            </Label>
            <Textarea
              id="legal-intro"
              rows={2}
              value={draft.intro ?? ''}
              onChange={(e) => patchDraft({ intro: e.target.value })}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              {t('LEGAL_FIELD_INTRO_HELP')}
            </Text>
          </div>

          <div className="flex flex-col gap-2">
            <Label size="small" weight="plus" htmlFor="legal-seo">
              {t('LEGAL_FIELD_SEO')}
            </Label>
            <Textarea
              id="legal-seo"
              rows={2}
              value={draft.seo_description ?? ''}
              onChange={(e) => patchDraft({ seo_description: e.target.value })}
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              {t('LEGAL_FIELD_SEO_HELP')}
            </Text>
          </div>

          {/* ── Secciones ────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-2 border-t border-ui-border-base pt-4">
            <div className="flex flex-col gap-0.5">
              <Label size="small" weight="plus">
                {t('LEGAL_SECTIONS_TITLE')}
              </Label>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('LEGAL_SECTIONS_HELP')}
              </Text>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() =>
                patchSections((sections) => [
                  ...sections,
                  { id: newSectionId(), name: '', html: '' },
                ])
              }
            >
              <Plus />
              {t('LEGAL_SECTION_ADD')}
            </Button>
          </div>

          {draft.sections.length === 0 && (
            // No es un estado decorativo: guardar sin secciones NO vacía la página, la
            // devuelve al texto de ejemplo. Decirlo acá evita el reporte de "borré todo
            // y volvió solo".
            <Alert variant="info">{t('LEGAL_SECTIONS_EMPTY')}</Alert>
          )}

          <div className="flex flex-col gap-4">
            {draft.sections.map((sec, index) => (
              <div
                key={sec.id}
                className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4"
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-1 flex-col gap-1">
                    <Label size="xsmall" weight="plus" htmlFor={`legal-sec-${sec.id}`}>
                      {t('LEGAL_SECTION_NAME', { n: index + 1 })}
                    </Label>
                    <Input
                      id={`legal-sec-${sec.id}`}
                      placeholder={t('LEGAL_SECTION_NAME_PLACEHOLDER')}
                      value={sec.name}
                      onChange={(e) =>
                        patchSections((sections) =>
                          sections.map((s, i) =>
                            i === index ? { ...s, name: e.target.value } : s,
                          ),
                        )
                      }
                    />
                  </div>

                  {/* Subir/bajar en vez de arrastrar: el orden es lo único que hay que
                      poder cambiar, y un drag & drop accesible es bastante más código
                      que dos botones que además funcionan con teclado sin hacer nada. */}
                  <div className="flex items-center gap-1 pt-5">
                    <Tooltip content={t('LEGAL_SECTION_UP')}>
                      <IconButton
                        type="button"
                        size="small"
                        variant="transparent"
                        disabled={index === 0}
                        onClick={() =>
                          patchSections((sections) => move(sections, index, index - 1))
                        }
                      >
                        <ArrowUpMini />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content={t('LEGAL_SECTION_DOWN')}>
                      <IconButton
                        type="button"
                        size="small"
                        variant="transparent"
                        disabled={index === draft.sections.length - 1}
                        onClick={() =>
                          patchSections((sections) => move(sections, index, index + 1))
                        }
                      >
                        <ArrowDownMini />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content={t('LEGAL_SECTION_REMOVE')}>
                      <IconButton
                        type="button"
                        size="small"
                        variant="transparent"
                        onClick={() =>
                          patchSections((sections) =>
                            sections.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>

                <LegalHtmlEditor
                  value={sec.html}
                  onChange={(html) =>
                    patchSections((sections) =>
                      sections.map((s, i) => (i === index ? { ...s, html } : s)),
                    )
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-ui-border-base pt-4">
            <Text size="xsmall" className="text-ui-fg-muted">
              {t('LEGAL_PROPAGATION_HINT')}
            </Text>
            <div className="flex items-center gap-2">
              {!isSample && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={handleReset}
                >
                  {t('LEGAL_RESET')}
                </Button>
              )}
              <Button type="button" disabled={saving || !dirty} onClick={handleSave}>
                {t('LEGAL_SAVE')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LegalPagesCard;
