import { Puck, usePuck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { Button, Heading, Text, Toaster, toast, usePrompt } from '@medusajs/ui';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDemoStore, useUpdateDemoStore } from '../../../../hooks/api/demo-stores';
import { useStorefrontOrigins } from '../../../../hooks/use-storefront-base';
import { buildPublicUrlFrom, formatPublicUrlFrom } from '../../lib';
import { DEFAULT_HOME_LAYOUT, homeConfig } from '../../../../lib/puck/home-config';

const EMPTY_DATA = { content: [], root: { props: {} } } as unknown as Data;

const hasContent = (data: unknown): data is Data =>
  !!data &&
  typeof data === 'object' &&
  Array.isArray((data as any).content) &&
  (data as any).content.length > 0;

/**
 * Editor Puck del home de un demo ("Personalizar home").
 *
 * Espeja el editor de landings pero scopeado a demos: carga/guarda
 * `demo.home_puck_data` vía la API de demo-stores y usa la config de secciones
 * del home. Si el demo no tiene home guardada, siembra el layout por defecto de
 * su template (DEFAULT_HOME_LAYOUT) para poder editar/quitar secciones desde el
 * home real. Guardar persiste el documento Puck y el storefront lo renderiza en
 * /demo/{slug} (ver HomeRenderer).
 */
const DemoHomeEditor = () => {
  const navigate = useNavigate();
  const prompt = usePrompt();
  const { id = '' } = useParams();

  const { data, isLoading } = useDemoStore(id);
  const demo = data?.demo_store;
  const updateMut = useUpdateDemoStore(id);

  // Puck recibe `data` solo al montar; para reflejar un "restablecer" forzamos
  // remount cambiando `puckKey` y guardamos la data aplicada en estado.
  const [editorData, setEditorData] = useState<Data | null>(null);
  const [puckKey, setPuckKey] = useState(0);

  /**
   * LA BASE DE LA INSTANCIA, NO LA URL DE LA TIENDA ACTIVA.
   *
   * `buildPublicUrlFrom(demo, ...)` recibe esto como BASE y le agrega él mismo el
   * prefijo de la tienda que se está EDITANDO —la del `[id]` de la URL, que no tiene
   * por qué ser la activa—. Con la URL de la activa el link quedaba
   * `<base>/tienda/<activa>/tienda/<editada>`: un 404. La forma de subdominio se
   * salvaba de casualidad (`new URL(base)` tira el path), pero la de RUTA es el
   * default porque `SITE_HOST_SUFFIX` viene vacío, así que rompía el caso normal.
   *
   * Acá había un `fetch` crudo a `admin/store-config/storefront-url` sin `x-site-id`,
   * y `site-transport.test.ts` lo contaba como la última unidad de deuda de transporte
   * del admin: mandar el header habría empeorado la pantalla, porque la ruta devolvía
   * un solo campo para dos trabajos distintos. Ahora devuelve los dos (`url` = tienda
   * activa, `base` = instancia), así que el header ya no molesta y esto puede ir por el
   * `fetchJson` compartido como el resto del admin.
   */
  const { base: storefrontBase, sitesBase, hostSuffix } = useStorefrontOrigins();

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

  // Data inicial: la guardada si tiene contenido; si no, el layout real del
  // template del demo (secciones reales, editables) para abrir mostrando su home.
  const seeded = (DEFAULT_HOME_LAYOUT[demo.template_code] ?? EMPTY_DATA) as unknown as Data;
  const currentData =
    editorData ?? (hasContent(demo.home_puck_data) ? (demo.home_puck_data as Data) : seeded);

  const applyToEditor = (puckData: unknown) => {
    setEditorData(puckData as Data);
    setPuckKey((k) => k + 1);
  };

  const handleSave = async (data: Data) => {
    try {
      await updateMut.mutateAsync({ home_puck_data: data as any });
      setEditorData(data);
      toast.success('Home guardada');
    } catch (error: any) {
      toast.error(`No se pudo guardar: ${error?.message ?? ''}`);
    }
  };

  const handleReset = async () => {
    const confirmed = await prompt({
      title: 'Restablecer home',
      description:
        'Vuelve al layout inicial de ejemplo. Se pierden los cambios sin guardar.',
      confirmText: 'Restablecer',
      cancelText: 'Cancelar',
    });
    if (confirmed) applyToEditor(seeded);
  };

  // El header de Puck: reemplazamos las acciones por un "Guardar cambios" que
  // toma el estado actual del editor.
  const PuckSaveButton = () => {
    const { appState } = usePuck();
    return (
      <Button size="small" onClick={() => handleSave(appState.data)} isLoading={updateMut.isPending}>
        Guardar cambios
      </Button>
    );
  };

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
            {formatPublicUrlFrom(demo, { baseUrl: storefrontBase, sitesBaseUrl: sitesBase, hostSuffix })}
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <Button size="small" variant="transparent" onClick={handleReset}>
            Restablecer
          </Button>
          <a
            href={buildPublicUrlFrom(demo, {
              baseUrl: storefrontBase,
              sitesBaseUrl: sitesBase, hostSuffix,
            })}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-ui-fg-interactive"
          >
            Vista previa ↗
          </a>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {/* `key` fuerza remount al restablecer. onPublish guarda home_puck_data. */}
        <Puck
          key={puckKey}
          config={homeConfig}
          data={currentData}
          onPublish={handleSave}
          overrides={{ headerActions: () => <PuckSaveButton /> }}
        />
      </div>

      <Toaster />
    </div>
  );
};

export default DemoHomeEditor;
