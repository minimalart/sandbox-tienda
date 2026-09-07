import { defineRouteConfig } from '@medusajs/admin-sdk';
import { Trash } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Toaster,
  toast,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { HelpDrawer } from '../../../components/common/help-drawer';
import {
  useCreateRecommendationRelations,
  useDeleteRecommendationRelation,
  useRecommendationRelations,
  useUpdateRecommendationRelation,
  type ProductCard as ProductCardData,
  type RecommendationRelation,
  type RelationType,
} from '../../../hooks/api/recommendations';
import { MissingProductCard, ProductCard } from './components/product-card';
import { ProductPicker } from './components/product-picker';

// Sin `config` el sidebar no anida el sub-ítem y la página queda inalcanzable: el
// ítem padre redirige a Configuración y no hay ningún otro enlace hacia acá.
export const config = defineRouteConfig({ label: 'Relaciones' });
export const handle = { breadcrumb: () => 'Relaciones' };

/** Sólo los tipos que el merchant elige a mano (PRD §6.1). */
const MANUAL_RELATION_TYPES: Array<{ value: RelationType; label: string }> = [
  { value: 'complementary', label: 'Complementario' },
  { value: 'similar', label: 'Similar' },
  { value: 'accessory', label: 'Accesorio' },
  { value: 'replacement', label: 'Repuesto' },
  { value: 'alternative', label: 'Alternativa' },
  { value: 'upgrade', label: 'Upgrade' },
];

const RELATION_LABELS = Object.fromEntries(
  MANUAL_RELATION_TYPES.map((type) => [type.value, type.label]),
) as Record<string, string>;

/** Fila de una relación existente: prioridad, activo, vigencia y borrado. */
function RelationRow({ relation }: { relation: RecommendationRelation }) {
  const update = useUpdateRecommendationRelation();
  const remove = useDeleteRecommendationRelation();
  const [priority, setPriority] = useState(String(relation.priority));

  const save = (patch: Record<string, unknown>) =>
    update.mutate(
      { id: relation.id, ...patch },
      { onError: (error: Error) => toast.error(error.message) },
    );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
      {relation.target_product ? (
        <ProductCard card={relation.target_product} />
      ) : (
        <MissingProductCard productId={relation.target_product_id} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Badge size="2xsmall">{RELATION_LABELS[relation.relation_type] ?? relation.relation_type}</Badge>

        <div className="flex items-center gap-1">
          <Text size="xsmall" className="text-ui-fg-subtle">
            Prioridad
          </Text>
          <Input
            type="number"
            className="w-20"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            onBlur={() => {
              const next = Number(priority);
              if (Number.isFinite(next) && next !== relation.priority) save({ priority: next });
            }}
          />
        </div>

        <label className="flex items-center gap-2">
          <Switch
            checked={relation.is_active}
            onCheckedChange={(checked) => save({ is_active: checked })}
          />
          <Text size="xsmall">{relation.is_active ? 'Activa' : 'Inactiva'}</Text>
        </label>

        <div className="flex items-center gap-1">
          <Text size="xsmall" className="text-ui-fg-subtle">
            Desde
          </Text>
          <Input
            type="date"
            className="w-36"
            defaultValue={relation.valid_from?.slice(0, 10) ?? ''}
            onChange={(event) => save({ valid_from: event.target.value || null })}
          />
        </div>
        <div className="flex items-center gap-1">
          <Text size="xsmall" className="text-ui-fg-subtle">
            Hasta
          </Text>
          <Input
            type="date"
            className="w-36"
            defaultValue={relation.valid_until?.slice(0, 10) ?? ''}
            onChange={(event) => save({ valid_until: event.target.value || null })}
          />
        </div>

        <IconButton
          size="small"
          variant="transparent"
          isLoading={remove.isPending}
          onClick={() =>
            remove.mutate(relation.id, {
              onSuccess: () => toast.success('Relación eliminada'),
              onError: (error: Error) => toast.error(error.message),
            })
          }
        >
          <Trash />
        </IconButton>
      </div>
    </div>
  );
}

const RelationsPage = () => {
  const [source, setSource] = useState<ProductCardData | null>(null);
  const [relationType, setRelationType] = useState<RelationType>('complementary');
  const [selected, setSelected] = useState<ProductCardData[]>([]);

  const create = useCreateRecommendationRelations();

  // Sin producto origen no se lista nada: la pantalla es "ver y editar las relaciones
  // DE un producto", no un volcado de la tabla entera.
  const { data, isPending } = useRecommendationRelations(
    source ? { source_product_id: source.id, limit: 100 } : { limit: 0 },
  );

  const existing = source ? (data?.relations ?? []) : [];
  const existingTargetIds = useMemo(
    () => existing.map((relation) => relation.target_product_id),
    [existing],
  );

  const excludeFromPicker = useMemo(
    () => [
      ...(source ? [source.id] : []),
      ...existingTargetIds,
      ...selected.map((product) => product.id),
    ],
    [source, existingTargetIds, selected],
  );

  const save = () => {
    if (!source || !selected.length) return;
    create.mutate(
      {
        source_product_id: source.id,
        target_product_ids: selected.map((product) => product.id),
        relation_type: relationType,
      },
      {
        onSuccess: (result) => {
          setSelected([]);
          toast.success(
            result.skipped
              ? `${result.created} relaciones creadas · ${result.skipped} ya existían`
              : `${result.created} relaciones creadas`,
          );
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Heading level="h1">Relaciones manuales</Heading>
          <ExtensionVersion extension="recommendation-engine" />
          {/* El drawer se monta acá y no sólo en Configuración porque de acá se sacó
              el párrafo de abajo: sacarle a una pantalla su explicación sin dejarle
              la puerta al drawer es esconder el texto, no mudarlo. */}
          <HelpDrawer slug="recommendation-engine" />
        </div>
        {/* Acá vivía el párrafo de "las relaciones manuales tienen prioridad sobre las
            calculadas y no se pisan con los recálculos". Está en el drawer, sección
            "Las relaciones manuales le ganan a todo", que además sigue con lo que acá
            no entraba: cómo se encadena el resto de las estrategias y por qué un
            bloque que muestra siempre lo mismo significa que las de arriba todavía no
            calcularon. Era cierto SIEMPRE y empujaba el formulario para abajo. */}

        {source ? (
          <div className="flex flex-col gap-2">
            <Label size="small" weight="plus">
              Producto origen
            </Label>
            <ProductCard
              card={source}
              right={
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => {
                    setSource(null);
                    setSelected([]);
                  }}
                >
                  Cambiar
                </Button>
              }
            />
          </div>
        ) : (
          <ProductPicker
            label="Elegí el producto origen"
            placeholder="Buscar el producto al que le vas a cargar recomendaciones…"
            onSelect={setSource}
          />
        )}
      </Container>

      {source ? (
        <>
          <Container className="flex flex-col gap-4">
            <Heading level="h2">Agregar productos relacionados</Heading>

            <div className="flex flex-col gap-1 sm:max-w-xs">
              <Label size="small" weight="plus">
                Tipo de relación
              </Label>
              <Select
                value={relationType}
                onValueChange={(value) => setRelationType(value as RelationType)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {MANUAL_RELATION_TYPES.map((type) => (
                    <Select.Item key={type.value} value={type.value}>
                      {type.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <ProductPicker
              label="Buscar productos para relacionar"
              excludeIds={excludeFromPicker}
              onSelect={(product) => setSelected((current) => [...current, product])}
            />

            {selected.length ? (
              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  Seleccionados ({selected.length})
                </Label>
                {selected.map((product) => (
                  <ProductCard
                    key={product.id}
                    card={product}
                    right={
                      <IconButton
                        size="small"
                        variant="transparent"
                        onClick={() =>
                          setSelected((current) => current.filter((p) => p.id !== product.id))
                        }
                      >
                        <Trash />
                      </IconButton>
                    }
                  />
                ))}
                <div>
                  <Button size="small" isLoading={create.isPending} onClick={save}>
                    Guardar {selected.length} relación{selected.length === 1 ? '' : 'es'}
                  </Button>
                </div>
              </div>
            ) : null}
          </Container>

          <Container className="flex flex-col gap-3">
            <Heading level="h2">
              Relaciones actuales {existing.length ? `(${existing.length})` : ''}
            </Heading>
            {isPending ? (
              <Text className="text-ui-fg-subtle">Cargando…</Text>
            ) : existing.length === 0 ? (
              <Text className="text-ui-fg-subtle">
                Este producto todavía no tiene relaciones manuales.
              </Text>
            ) : (
              existing.map((relation) => <RelationRow key={relation.id} relation={relation} />)
            )}
          </Container>
        </>
      ) : null}

      <Toaster />
    </div>
  );
};

export default RelationsPage;
