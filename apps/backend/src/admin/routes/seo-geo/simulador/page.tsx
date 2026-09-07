import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Badge, Button, Container, Heading, Text, Textarea, toast } from '@medusajs/ui';
import { useState } from 'react';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { useKeywords, useSimulator, type SimulatorResult } from '../../../hooks/api/seo-geo';

const SimuladorPage = () => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const simulate = useSimulator();
  /*
    El ejemplo sale de la categoría más grande de ESTA tienda, no de un literal.
    Estaba hardcodeado “¿Qué aspiradora recomendás para un departamento pequeño?”, que
    en una pinturería no es un ejemplo: es ruido que hace dudar de si la pantalla está
    mirando el catálogo correcto. Misma consulta que alimenta Keywords, así que el
    vocabulario es el del negocio.
  */
  const { data: keywords } = useKeywords();
  const example = keywords?.keywords?.[0]?.question ?? '¿Qué me recomendás para…?';

  const tooShort = prompt.trim().length < 3;

  const onRun = async (embed?: boolean) => {
    /*
      Antes esto era un `return` mudo: con el textarea vacío —o sea, mostrando el
      ejemplo en gris— los dos botones no hacían absolutamente nada, sin toast ni
      estado deshabilitado. La lectura obvia era “el simulador está roto”, y el
      backend nunca llegaba a contestar que falta indexar el catálogo o configurar la
      IA, que es lo que casi siempre pasa.
    */
    if (tooShort) {
      toast.info('Escribí una consulta primero: el simulador la busca contra el catálogo.');
      return;
    }
    try {
      const res = await simulate.mutateAsync({ prompt: prompt.trim(), embed });
      setResult(res);
      if (!res.configured) {
        toast.warning('La IA no está configurada (OPENROUTER_API_KEY / EMBEDDINGS_API_KEY).');
      } else if (res.indexed === 0) {
        toast.warning('El catálogo de esta tienda todavía no está indexado. Probá con “Indexar catálogo y simular”.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falló el simulador');
    }
  };

  return (
    /*
      Sin `divide-y`: los dos hijos son el header y el bloque de contenido, así que el
      divisor dibujaba UNA línea y el `border-b` explícito del header la repone. Va en
      el header porque `SiteScopeBar` devuelve `null` con 0 ó 1 tienda y si el borde
      viviera en la franja, en mono-tienda el título quedaría pegado al textarea.
    */
    <Container className="p-0">
      <div className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
        <Heading level="h1">Simulador IA</Heading>
      </div>

      {/*
        `scoped`, y es la pantalla donde el eje se nota más: acá el operador LEE la
        respuesta como si fuera la de su tienda.

        Las TRES mitades del simulador llevan la tienda (`simulator/route.ts:34-51`):
        la config —`top_k`, umbral de similitud y modelo— sale de
        `getSeoGeoConfig(req.scope, siteId)`, o sea la misma fila que edita
        `seo-geo/configuracion`; el "Reindexar catálogo" pasa el canal primario de la
        tienda a `embedCatalog`; y la recuperación recibe `allowedProductIds:
        productIdsForSite(req)`.

        Ese último filtro se aplica en memoria y NO en el WHERE, a propósito y
        documentado en `ai/simulator.ts:34-38`: `seo_geo_product_embedding` no tiene
        columna de canal —`product_id` es UNIQUE en toda la instalación— así que la
        pertenencia sólo se resuelve por el link de canal, que vive del lado del
        request. Lo que importa para esta franja es que el recorte llegue al resultado,
        y llega: `indexed` cuenta lo de ESTA tienda (`simulator.ts:60`) y el ranking
        corre sobre `rows`, ya filtrado. Antes contestaba con productos que la tienda
        no vende, con id y todo.
      */}
      <SiteScopeBar screen="seo-geo.simulador" />

      <div className="flex flex-col gap-4 px-6 py-6">
        <Text className="text-ui-fg-subtle" size="small">
          Escribí una consulta como la haría un cliente. El simulador recupera productos del catálogo por similitud y
          responde con IA usando sólo esos productos, mostrando cuáles usó y cuáles no (y por qué).
        </Text>
        <Textarea
          placeholder={example}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onRun(false)} isLoading={simulate.isPending} disabled={tooShort}>
            Simular
          </Button>
          {/*
            “Reindexar” prometía de más: no hay índice previo que rehacer hasta que
            alguien lo corre por primera vez, y la primera vez es justamente cuando el
            simulador contesta que no hay catálogo embebido.
          */}
          <Button variant="secondary" onClick={() => onRun(true)} isLoading={simulate.isPending} disabled={tooShort}>
            Indexar catálogo y simular
          </Button>
          {result && <Text size="small" className="text-ui-fg-muted">{result.indexed} productos indexados</Text>}
        </div>
        <Text size="xsmall" className="text-ui-fg-muted">
          {tooShort
            ? 'Escribí la consulta para habilitar los botones.'
            : 'Indexar recorre el catálogo de esta tienda y genera los embeddings; tarda más y sólo hace falta la primera vez o después de cambios grandes en las fichas.'}
        </Text>

        {result && (
          <div className="mt-2 flex flex-col gap-5">
            <div className="rounded-xl border border-ui-border-base bg-ui-bg-subtle p-4">
              <p className="text-ui-fg-subtle mb-1 text-xs">Respuesta de la IA</p>
              <Text className="whitespace-pre-wrap">{result.answer}</Text>
            </div>

            {result.used.length > 0 && (
              <div>
                <Heading level="h2" className="mb-2 text-base">Productos usados</Heading>
                <div className="flex flex-col gap-1">
                  {result.used.map((u) => (
                    <div key={u.product_id} className="flex items-center justify-between rounded-lg border border-ui-border-base px-3 py-2">
                      <Text size="small">{u.title || u.product_id}</Text>
                      <Badge size="2xsmall" color="green">sim {u.similarity}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.not_used.length > 0 && (
              <div>
                <Heading level="h2" className="mb-2 text-base">No utilizados</Heading>
                <div className="flex flex-col gap-1">
                  {result.not_used.map((u) => (
                    <div key={u.product_id} className="rounded-lg border border-ui-border-base px-3 py-2">
                      <div className="flex items-center justify-between">
                        <Text size="small">{u.title || u.product_id}</Text>
                        <Badge size="2xsmall" color="orange">sim {u.similarity}</Badge>
                      </div>
                      <Text size="xsmall" className="text-ui-fg-subtle">{u.reason}</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({ label: 'Simulador IA' });
export const handle = { breadcrumb: () => 'Simulador IA' };
export default SimuladorPage;
