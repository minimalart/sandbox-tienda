import {
  ArrowUpRightOnBox,
  CheckCircleSolid,
  DocumentText,
  EllipsisHorizontal,
  EyeSlash,
  Photo,
  Trash,
} from '@medusajs/icons';
import {
  Badge,
  Button,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Select,
  StatusBadge,
  Text,
  Toaster,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type AdminComment,
  type CommentResource,
  type CommentStatus,
  type CommentableType,
  useApproveComment,
  useComment,
  useComments,
  useDeleteComment,
  useHideComment,
} from '../../../hooks/api/comments';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<CommentStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  hidden: 'Oculto',
  deleted: 'Eliminado',
};
const STATUS_COLOR: Record<CommentStatus, 'green' | 'grey' | 'orange' | 'red'> = {
  pending: 'orange',
  approved: 'green',
  hidden: 'grey',
  deleted: 'red',
};
const TYPE_LABEL: Record<CommentableType, string> = {
  product: 'Producto',
  blog_post: 'Blog',
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('es-AR') : '-';

const Stars = ({ rating }: { rating: number | null }) =>
  rating == null ? (
    <span className="text-ui-fg-muted">—</span>
  ) : (
    <span className="text-ui-fg-base">{'★'.repeat(rating)}<span className="text-ui-fg-muted">({rating})</span></span>
  );

// ── Recurso comentado (producto / artículo) ─────────────────────────────────

/** Miniatura del producto; ícono según el tipo cuando no hay imagen. */
const ResourceThumb = ({
  type,
  thumbnail,
  size = 'small',
}: {
  type: CommentableType;
  thumbnail: string | null;
  size?: 'small' | 'large';
}) => {
  const box = size === 'large' ? 'h-12 w-12' : 'h-8 w-8';
  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-component`}
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
      ) : type === 'blog_post' ? (
        <DocumentText className="text-ui-fg-muted" />
      ) : (
        <Photo className="text-ui-fg-muted" />
      )}
    </div>
  );
};

/** Título a mostrar: el del recurso, o el id crudo si ya no se puede resolver. */
const resourceTitle = (comment: AdminComment): string =>
  comment.resource?.title || comment.commentable_id;

/** Abre la publicación pública en una pestaña nueva. */
const openStorefront = (resource?: CommentResource | null) => {
  if (resource?.storefront_url) {
    window.open(resource.storefront_url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Celda "Publicación": miniatura + título del producto/artículo comentado, con
 * el tipo debajo. Reemplaza la columna "Tipo" (el tipo sigue visible, sin gastar
 * una columna extra) y responde a "¿de qué es este comentario?".
 *
 * El título lleva a la ficha en el admin y el ícono a la publicación pública; los
 * dos cortan la propagación para no abrir el drawer del comentario (onRowClick).
 */
const ResourceCell = ({ comment }: { comment: AdminComment }) => {
  const navigate = useNavigate();
  const resource = comment.resource;
  const title = resourceTitle(comment);
  const adminPath = resource?.admin_path;

  return (
    <div className="flex w-[280px] items-center gap-2">
      <ResourceThumb
        type={comment.commentable_type}
        thumbnail={resource?.thumbnail ?? null}
      />
      <div className="min-w-0">
        {adminPath ? (
          <button
            type="button"
            className="block max-w-full truncate text-left text-ui-fg-base hover:underline"
            title={`Abrir ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              navigate(adminPath);
            }}
          >
            {title}
          </button>
        ) : (
          <span className="block truncate text-ui-fg-base" title={title}>
            {title}
          </span>
        )}
        <span className="block truncate text-ui-fg-muted txt-compact-xsmall">
          {TYPE_LABEL[comment.commentable_type]}
          {resource ? '' : ' · no disponible'}
          {resource?.status === 'draft' ? ' · borrador' : ''}
        </span>
      </div>
      {resource?.storefront_url ? (
        <IconButton
          size="small"
          variant="transparent"
          className="ml-auto shrink-0"
          title="Ver publicación en la tienda"
          onClick={(e) => {
            e.stopPropagation();
            openStorefront(resource);
          }}
        >
          <ArrowUpRightOnBox />
        </IconButton>
      ) : null}
    </div>
  );
};

/**
 * Ficha del recurso comentado dentro del detalle: qué se comentó y los dos
 * accesos directos — la ficha en el admin y la publicación pública.
 */
const ResourceSummary = ({ comment }: { comment: AdminComment }) => {
  const navigate = useNavigate();
  const resource = comment.resource;
  const isProduct = comment.commentable_type === 'product';
  const title = resourceTitle(comment);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
      <div className="flex items-center gap-3">
        <ResourceThumb
          type={comment.commentable_type}
          thumbnail={resource?.thumbnail ?? null}
          size="large"
        />
        <div className="min-w-0">
          <Text size="xsmall" className="text-ui-fg-muted">
            {TYPE_LABEL[comment.commentable_type]}
          </Text>
          <Text size="small" weight="plus" className="truncate" title={title}>
            {title}
          </Text>
          {resource?.status === 'draft' ? (
            <Badge size="2xsmall">Borrador</Badge>
          ) : null}
        </div>
      </div>
      {resource ? (
        <div className="flex flex-wrap gap-2">
          {resource.admin_path ? (
            <Button
              size="small"
              variant="secondary"
              onClick={() => navigate(resource.admin_path as string)}
            >
              {isProduct ? 'Ver producto' : 'Ver artículo'}
            </Button>
          ) : null}
          {resource.storefront_url ? (
            <Button
              size="small"
              variant="transparent"
              onClick={() => openStorefront(resource)}
            >
              <ArrowUpRightOnBox className="mr-1" />
              Ver publicación
            </Button>
          ) : null}
        </div>
      ) : (
        <Text size="xsmall" className="text-ui-fg-muted">
          El recurso ya no está disponible ({comment.commentable_id}).
        </Text>
      )}
    </div>
  );
};

const CommentDetail = ({
  id,
  onClose,
  onAction,
}: {
  id: string | null;
  onClose: () => void;
  onAction: (id: string, action: 'approve' | 'hide' | 'delete') => void;
}) => {
  const { data } = useComment(id);
  const comment = data?.comment;
  return (
    <Drawer open={!!id} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <Drawer.Header>
          <div className="flex items-center gap-2">
            <Heading>{comment?.author_name || comment?.customer_id}</Heading>
            {comment ? (
              <StatusBadge color={STATUS_COLOR[comment.status]}>
                {STATUS_LABEL[comment.status]}
              </StatusBadge>
            ) : null}
          </div>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-y-auto">
          {comment ? (
            <>
              <ResourceSummary comment={comment} />
              <div className="flex flex-wrap items-center gap-2">
                {comment.verified_buyer ? (
                  <Badge size="2xsmall" color="green">Comprador verificado</Badge>
                ) : null}
                <Stars rating={comment.rating} />
              </div>
              {comment.content ? (
                <div className="whitespace-pre-wrap rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 text-sm">
                  {comment.content}
                </div>
              ) : (
                <Text size="small" className="text-ui-fg-subtle">Sin comentario (solo puntaje).</Text>
              )}
              {comment.replies && comment.replies.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
                    Respuestas ({comment.replies.length})
                  </Text>
                  {comment.replies.map((r) => (
                    <div key={r.id} className="rounded-lg border border-ui-border-base p-3">
                      <Text size="xsmall" weight="plus">{r.author_name || r.customer_id}</Text>
                      <Text size="small" className="whitespace-pre-wrap">{r.content}</Text>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 border-ui-border-base border-t pt-3">
                {comment.status !== 'approved' && (
                  <Button size="small" variant="secondary" onClick={() => onAction(comment.id, 'approve')}>
                    Aprobar
                  </Button>
                )}
                {comment.status !== 'hidden' && (
                  <Button size="small" variant="secondary" onClick={() => onAction(comment.id, 'hide')}>
                    Ocultar
                  </Button>
                )}
                <Button size="small" variant="danger" onClick={() => onAction(comment.id, 'delete')}>
                  Eliminar
                </Button>
              </div>
            </>
          ) : null}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};

const columnHelper = createDataTableColumnHelper<AdminComment>();

export const CommentsList = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CommentStatus | undefined>(undefined);
  const [type, setType] = useState<CommentableType | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isLoading } = useComments({
    limit: pagination.pageSize,
    offset,
    status,
    commentable_type: type,
  });
  const approve = useApproveComment();
  const hide = useHideComment();
  const del = useDeleteComment();

  const items = data?.comments ?? [];
  const count = data?.count ?? 0;

  const runAction = async (
    id: string,
    action: 'approve' | 'hide' | 'delete',
  ) => {
    try {
      if (action === 'approve') await approve.mutateAsync(id);
      if (action === 'hide') await hide.mutateAsync(id);
      if (action === 'delete') await del.mutateAsync(id);
      toast.success('Comentario actualizado');
    } catch (error) {
      toast.error((error as Error)?.message ?? 'No se pudo actualizar');
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'resource',
        header: 'Publicación',
        cell: ({ row }) => <ResourceCell comment={row.original} />,
      }),
      columnHelper.accessor('author_name', {
        header: 'Usuario',
        cell: ({ row }) => row.original.author_name || row.original.customer_id,
      }),
      columnHelper.accessor('rating', {
        header: 'Puntaje',
        cell: ({ getValue }) => <Stars rating={getValue()} />,
      }),
      columnHelper.accessor('content', {
        header: 'Comentario',
        cell: ({ getValue }) => (
          <span
            className="block max-w-[280px] truncate text-ui-fg-subtle"
            title={getValue() ?? ''}
          >
            {getValue() || '—'}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: ({ getValue }) => (
          <StatusBadge color={STATUS_COLOR[getValue()]}>
            {STATUS_LABEL[getValue()]}
          </StatusBadge>
        ),
      }),
      columnHelper.accessor('reply_count', {
        header: 'Resp.',
        cell: ({ getValue }) => getValue() ?? 0,
      }),
      columnHelper.accessor('created_at', {
        header: 'Fecha',
        cell: ({ getValue }) => fmtDate(getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <IconButton variant="transparent">
                  <EllipsisHorizontal />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content className="z-[60]">
                <DropdownMenu.Item onClick={() => setDetailId(row.original.id)}>
                  Ver detalle
                </DropdownMenu.Item>
                {row.original.resource?.admin_path ? (
                  <DropdownMenu.Item
                    onClick={() =>
                      navigate(row.original.resource?.admin_path as string)
                    }
                  >
                    {row.original.commentable_type === 'product'
                      ? 'Ver producto'
                      : 'Ver artículo'}
                  </DropdownMenu.Item>
                ) : null}
                {row.original.resource?.storefront_url ? (
                  <DropdownMenu.Item
                    onClick={() => openStorefront(row.original.resource)}
                  >
                    <ArrowUpRightOnBox className="mr-2" /> Ver publicación
                  </DropdownMenu.Item>
                ) : null}
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => runAction(row.original.id, 'approve')}>
                  <CheckCircleSolid className="mr-2" /> Aprobar
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => runAction(row.original.id, 'hide')}>
                  <EyeSlash className="mr-2" /> Ocultar
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => runAction(row.original.id, 'delete')}>
                  <Trash className="mr-2" /> Eliminar
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        ),
      }),
    ],
    // runAction / navigate are stable enough for our needs; deps kept minimal
    // intentionally (recrear las columnas resetea el estado de la tabla).
    [],
  );

  const table = useDataTable({
    columns,
    data: items,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => setDetailId(row.id),
  });

  return (
    <div>
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-wrap items-center gap-3 px-6 py-4">
          <div className="w-[180px]">
            <Select
              value={status ?? 'all'}
              onValueChange={(v) => {
                setStatus(v === 'all' ? undefined : (v as CommentStatus));
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="Estado" />
              </Select.Trigger>
              <Select.Content className="z-[60]">
                <Select.Item value="all">Todos los estados</Select.Item>
                <Select.Item value="pending">Pendiente</Select.Item>
                <Select.Item value="approved">Aprobado</Select.Item>
                <Select.Item value="hidden">Oculto</Select.Item>
                <Select.Item value="deleted">Eliminado</Select.Item>
              </Select.Content>
            </Select>
          </div>
          <div className="w-[180px]">
            <Select
              value={type ?? 'all'}
              onValueChange={(v) => {
                setType(v === 'all' ? undefined : (v as CommentableType));
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="Tipo" />
              </Select.Trigger>
              <Select.Content className="z-[60]">
                <Select.Item value="all">Todos los tipos</Select.Item>
                <Select.Item value="product">Producto</Select.Item>
                <Select.Item value="blog_post">Blog</Select.Item>
              </Select.Content>
            </Select>
          </div>
          <Text size="small" className="ml-auto text-ui-fg-subtle">
            {count} {count === 1 ? 'comentario' : 'comentarios'}
          </Text>
        </DataTable.Toolbar>
        {count > 0 || isLoading ? (
          <>
            <DataTable.Table />
            <DataTable.Pagination />
          </>
        ) : (
          <div className="flex items-center justify-center border-t p-6 text-center">
            <Text className="text-ui-fg-subtle">No hay comentarios.</Text>
          </div>
        )}
      </DataTable>

      <CommentDetail
        id={detailId}
        onClose={() => setDetailId(null)}
        onAction={(id, action) => {
          runAction(id, action);
          setDetailId(null);
        }}
      />
      <Toaster />
    </div>
  );
};
