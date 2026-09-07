import {
  Button,
  Checkbox,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  FocusModal,
  Heading,
  Input,
  Label,
  ProgressTabs,
  StatusBadge,
  Text,
  Textarea,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAdminCategories,
  useAdminCollections,
  useAdminProducts,
  useCatalogadorConfig,
  useAdminTags,
  useCreateExecution,
  useGenerateExecution,
  type AdminProductRow,
} from '../../../hooks/api';

export const handle = { breadcrumb: () => 'Nueva ejecución' };

type TabId = 'details' | 'products' | 'improvements';
type ProgressStatus = 'not-started' | 'in-progress' | 'completed';

const TEXT_FIELDS: Array<{ field: string; label: string }> = [
  { field: 'subtitle', label: 'Subtítulo' },
  { field: 'description', label: 'Descripción' },
  { field: 'meta_title', label: 'Meta title (SEO)' },
  { field: 'meta_description', label: 'Meta description (SEO)' },
  { field: 'keywords', label: 'Keywords (SEO)' },
  { field: 'categories', label: 'Categorías (existentes)' },
  { field: 'tags', label: 'Tags (existentes)' },
  { field: 'alt_text', label: 'Texto alternativo de imagen' },
];
const IMAGE_TECH: Array<{ field: string; label: string }> = [
  { field: 'to_webp', label: 'Convertir a WebP' },
  { field: 'compress', label: 'Comprimir' },
  { field: 'resize', label: 'Redimensionar' },
  { field: 'normalize', label: 'Normalizar (cuadrado fondo blanco)' },
];
const IMAGE_AI: Array<{ field: string; label: string }> = [
  { field: 'recreate', label: 'Recrear imagen (fondo blanco)' },
  { field: 'lifestyle', label: 'Generar imagen lifestyle' },
  { field: 'generate_missing', label: 'Generar imagen faltante' },
  { field: 'variation', label: 'Variaciones de una imagen' },
];
/** PRD §4/§6.1: operación editable, separada de `lifestyle` y opt-in. */
const IMAGE_AI_EDITABLE = { field: 'lifestyle_editable', label: 'Lifestyle editable' };

const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper<AdminProductRow>();
const allOf = (items: Array<{ field: string }>) => new Set(items.map((i) => i.field));

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'details', label: 'Detalles' },
  { id: 'products', label: 'Productos' },
  { id: 'improvements', label: 'Mejoras' },
];

const NewExecution = () => {
  const navigate = useNavigate();
  const createExecution = useCreateExecution();
  const generate = useGenerateExecution();

  const [tab, setTab] = useState<TabId>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Selección de productos (server-side).
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [tagId, setTagId] = useState('');
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const { data: catData } = useAdminCategories();
  const { data: colData } = useAdminCollections();
  const { data: tagData } = useAdminTags();
  const { data: cfgData } = useCatalogadorConfig();
  const editableLifestyleEnabled =
    ((cfgData?.config?.image_ai as Record<string, unknown> | undefined)?.editable_lifestyle_enabled ?? true) !== false;
  const imageAiItems = useMemo(
    () => (editableLifestyleEnabled ? [...IMAGE_AI, IMAGE_AI_EDITABLE] : IMAGE_AI),
    [editableLifestyleEnabled]
  );

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data: prodData, isPending: prodLoading } = useAdminProducts({
    limit: pagination.pageSize,
    offset,
    q: search || undefined,
    category_id: categoryId || undefined,
    collection_id: collectionId || undefined,
    tag_id: tagId || undefined,
  });
  const products = prodData?.products ?? [];
  const productCount = prodData?.count ?? 0;

  // Operaciones — TODO seleccionado por defecto (el usuario destilda lo que no quiere).
  const [textFields, setTextFields] = useState<Set<string>>(() => allOf(TEXT_FIELDS));
  const [techOps, setTechOps] = useState<Set<string>>(() => allOf(IMAGE_TECH));
  const [aiOps, setAiOps] = useState<Set<string>>(() => allOf(IMAGE_AI));

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const totalOps = textFields.size + techOps.size + aiOps.size;

  const columns = useMemo(
    () => [
      columnHelper.select(),
      columnHelper.accessor('title', {
        header: 'Producto',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.thumbnail ? (
              <img src={row.original.thumbnail} alt="" className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="h-8 w-8 rounded bg-ui-bg-subtle" />
            )}
            <span className="font-medium">{row.original.title}</span>
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: ({ getValue }) => (
          <StatusBadge color={getValue() === 'published' ? 'green' : 'grey'}>{getValue()}</StatusBadge>
        ),
      }),
    ],
    []
  );

  const table = useDataTable({
    columns,
    data: products,
    getRowId: (row) => row.id,
    rowCount: productCount,
    isLoading: prodLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    rowSelection: { state: rowSelection, onRowSelectionChange: setRowSelection },
  });

  const toggleSet = (set: Set<string>, setter: (s: Set<string>) => void, field: string) => {
    const next = new Set(set);
    next.has(field) ? next.delete(field) : next.add(field);
    setter(next);
  };

  const close = () => navigate('/catalogador');

  const create = async (generateNow: boolean) => {
    const operations = [
      ...[...textFields].map((field) => ({ type: 'text_field' as const, field })),
      ...[...techOps].map((field) => ({ type: 'image_technical' as const, field })),
      ...[...aiOps].map((field) => ({ type: 'image_ai' as const, field })),
    ];
    try {
      const { execution } = await createExecution.mutateAsync({
        name: name.trim() || `Ejecución ${new Date().toLocaleString()}`,
        product_ids: selectedIds,
        operations,
        selection_definition: {
          q: search || undefined,
          category_id: categoryId || undefined,
          collection_id: collectionId || undefined,
          tag_id: tagId || undefined,
          description: description || undefined,
        },
      });
      if (generateNow) await generate.mutateAsync({ id: execution.id });
      toast.success(generateNow ? 'Ejecución creada y generación iniciada' : 'Borrador guardado');
      navigate(`/catalogador/${execution.id}`);
    } catch (e) {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : 'error'}`);
    }
  };

  const detailsStatus: ProgressStatus =
    tab === 'details' ? 'in-progress' : name.trim() ? 'completed' : 'not-started';
  const productsStatus: ProgressStatus =
    tab === 'products' ? 'in-progress' : selectedIds.length ? 'completed' : 'not-started';
  const improvementsStatus: ProgressStatus =
    tab === 'improvements' ? 'in-progress' : 'not-started';
  const statusFor = (id: TabId): ProgressStatus =>
    id === 'details' ? detailsStatus : id === 'products' ? productsStatus : improvementsStatus;

  const onFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  return (
    <FocusModal open onOpenChange={(o) => !o && close()}>
      <FocusModal.Content>
        <FocusModal.Header className="flex shrink-0 items-center gap-4">
          <FocusModal.Title asChild>
            <span className="sr-only">Crear ejecución</span>
          </FocusModal.Title>
          <ProgressTabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="w-full min-w-0">
            <div className="-my-2 w-full border-l">
              <ProgressTabs.List>
                {TABS.map((t) => (
                  <ProgressTabs.Trigger key={t.id} value={t.id} status={statusFor(t.id)}>
                    {t.label}
                  </ProgressTabs.Trigger>
                ))}
              </ProgressTabs.List>
            </div>
          </ProgressTabs>
        </FocusModal.Header>

        <FocusModal.Body className="min-h-0 min-w-0 flex-1 overflow-hidden p-0">
          {/* Paso 1 — Detalles (nombre) */}
          {tab === 'details' && (
            <div className="h-full min-h-0 w-full overflow-y-auto">
              <div className="mx-auto flex w-full max-w-[640px] flex-col gap-8 px-8 py-10">
                <div>
                  <Heading>Crear ejecución</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    Dale un nombre a esta ejecución de enriquecimiento.
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Label size="small">Título *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Completar descripciones faltantes" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label size="small">Descripción</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Opcional" />
                </div>
              </div>
            </div>
          )}

          {/* Paso 2 — Productos (DataTable server-side + filtros y buscador en una sola fila) */}
          {tab === 'products' && (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
              <DataTable instance={table} className="h-full min-h-0">
                <DataTable.Toolbar className="flex shrink-0 flex-wrap items-center gap-2 px-6 py-3">
                  <FilterSelect label="Categoría" value={categoryId} onChange={onFilterChange(setCategoryId)} options={(catData?.product_categories ?? []).map((c) => ({ value: c.id, label: c.name }))} />
                  <FilterSelect label="Colección" value={collectionId} onChange={onFilterChange(setCollectionId)} options={(colData?.collections ?? []).map((c) => ({ value: c.id, label: c.title }))} />
                  <FilterSelect label="Etiqueta" value={tagId} onChange={onFilterChange(setTagId)} options={(tagData?.product_tags ?? []).map((t) => ({ value: t.id, label: t.value }))} />
                  <span className="text-ui-fg-subtle text-sm">
                    {selectedIds.length} sel. · {productCount}
                  </span>
                  <div className="ml-auto">
                    <DataTable.Search placeholder="Buscar productos" />
                  </div>
                </DataTable.Toolbar>
                <DataTable.Table />
                <DataTable.Pagination />
              </DataTable>
            </div>
          )}

          {/* Paso 3 — Mejoras */}
          {tab === 'improvements' && (
            <div className="h-full min-h-0 w-full overflow-y-auto">
              <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-8 py-10">
                <OpsGroup title="Contenido y catalogación (IA)" items={TEXT_FIELDS} set={textFields} setAll={() => setTextFields(allOf(TEXT_FIELDS))} setNone={() => setTextFields(new Set())} onToggle={(f) => toggleSet(textFields, setTextFields, f)} />
                <OpsGroup title="Procesamiento técnico de imágenes" items={IMAGE_TECH} set={techOps} setAll={() => setTechOps(allOf(IMAGE_TECH))} setNone={() => setTechOps(new Set())} onToggle={(f) => toggleSet(techOps, setTechOps, f)} />
                <OpsGroup title="Generación de imágenes (IA)" items={imageAiItems} set={aiOps} setAll={() => setAiOps(allOf(imageAiItems))} setNone={() => setAiOps(new Set())} onToggle={(f) => toggleSet(aiOps, setAiOps, f)} />
              </div>
            </div>
          )}
        </FocusModal.Body>

        <FocusModal.Footer className="shrink-0">
          <div className="flex items-center justify-end gap-x-2">
            <Button variant="secondary" size="small" onClick={close}>
              Cancelar
            </Button>
            {tab === 'details' && (
              <Button size="small" disabled={!name.trim()} onClick={() => setTab('products')}>
                Continuar
              </Button>
            )}
            {tab === 'products' && (
              <Button size="small" disabled={selectedIds.length === 0} onClick={() => setTab('improvements')}>
                Continuar ({selectedIds.length})
              </Button>
            )}
            {tab === 'improvements' && (
              <>
                <Button size="small" variant="secondary" disabled={totalOps === 0} isLoading={createExecution.isPending} onClick={() => create(false)}>
                  Guardar borrador
                </Button>
                <Button size="small" disabled={totalOps === 0 || selectedIds.length === 0} isLoading={createExecution.isPending} onClick={() => create(true)}>
                  Crear y generar
                </Button>
              </>
            )}
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  );
};

const FilterSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <select className="bg-ui-bg-field border-ui-border-base h-8 rounded-md border px-2 text-sm" value={value} onChange={onChange}>
    <option value="">{label}: todas</option>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

const OpsGroup = ({
  title,
  items,
  set,
  onToggle,
  setAll,
  setNone,
}: {
  title: string;
  items: Array<{ field: string; label: string }>;
  set: Set<string>;
  onToggle: (field: string) => void;
  setAll: () => void;
  setNone: () => void;
}) => (
  <div className="rounded-lg border p-3">
    <div className="mb-2 flex items-center justify-between">
      <Text size="small" weight="plus">
        {title}
      </Text>
      <div className="flex gap-1">
        <Button size="small" variant="transparent" onClick={setAll}>
          Todos
        </Button>
        <Button size="small" variant="transparent" onClick={setNone}>
          Ninguno
        </Button>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {items.map((it) => (
        <label key={it.field} className="flex items-center gap-2">
          <Checkbox checked={set.has(it.field)} onCheckedChange={() => onToggle(it.field)} />
          <span className="text-sm">{it.label}</span>
        </label>
      ))}
    </div>
  </div>
);

export default NewExecution;
