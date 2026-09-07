import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { EllipsisHorizontal, ArrowUpRightOnBox, CheckCircleSolid, EyeSlash, Trash, DocumentText, Photo, ChatBubbleLeftRight } from "@medusajs/icons";
import { createDataTableColumnHelper, StatusBadge, DropdownMenu, IconButton, useDataTable, DataTable, Select, Text, Toaster, toast, Drawer, Heading, Badge, Button, Switch, Input, Label, Container, Tabs } from "@medusajs/ui";
import { SiteScopeBar } from "@minimalart/mercatto-plugin-runtime/admin";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import "@medusajs/admin-shared";
const BASE_URL = "/admin/comments";
const COMMENTS_QUERY_KEY = ["comments"];
const COMMENT_SETTINGS_QUERY_KEY = ["comment-settings"];
async function fetchJson(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init == null ? void 0 : init.headers) ?? {} }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}
function useComments(params) {
  const qs = new URLSearchParams();
  if ((params == null ? void 0 : params.limit) != null) qs.set("limit", String(params.limit));
  if ((params == null ? void 0 : params.offset) != null) qs.set("offset", String(params.offset));
  if (params == null ? void 0 : params.status) qs.set("status", params.status);
  if (params == null ? void 0 : params.commentable_type)
    qs.set("commentable_type", params.commentable_type);
  if (params == null ? void 0 : params.customer_id) qs.set("customer_id", params.customer_id);
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;
  return useQuery({
    queryKey: [...COMMENTS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson(url)
  });
}
function useComment(id) {
  return useQuery({
    queryKey: [...COMMENTS_QUERY_KEY, "detail", id],
    queryFn: () => fetchJson(`${BASE_URL}/${id}`),
    enabled: !!id
  });
}
function useModerationMutation(action) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => qc.invalidateQueries({ queryKey: COMMENTS_QUERY_KEY })
  });
}
const useApproveComment = () => useModerationMutation(
  (id) => fetchJson(`${BASE_URL}/${id}/approve`, { method: "POST" })
);
const useHideComment = () => useModerationMutation(
  (id) => fetchJson(`${BASE_URL}/${id}/hide`, { method: "POST" })
);
const useDeleteComment = () => useModerationMutation(
  (id) => fetchJson(`${BASE_URL}/${id}`, { method: "DELETE" })
);
function useCommentSettings() {
  return useQuery({
    queryKey: COMMENT_SETTINGS_QUERY_KEY,
    queryFn: () => fetchJson(`${BASE_URL}/settings`)
  });
}
function useUpdateCommentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => fetchJson(`${BASE_URL}/settings`, {
      method: "POST",
      body: JSON.stringify(data)
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMMENT_SETTINGS_QUERY_KEY })
  });
}
const PAGE_SIZE = 20;
const STATUS_LABEL = {
  pending: "Pendiente",
  approved: "Aprobado",
  hidden: "Oculto",
  deleted: "Eliminado"
};
const STATUS_COLOR = {
  pending: "orange",
  approved: "green",
  hidden: "grey",
  deleted: "red"
};
const TYPE_LABEL = {
  product: "Producto",
  blog_post: "Blog"
};
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("es-AR") : "-";
const Stars = ({ rating }) => rating == null ? /* @__PURE__ */ jsx("span", { className: "text-ui-fg-muted", children: "—" }) : /* @__PURE__ */ jsxs("span", { className: "text-ui-fg-base", children: [
  "★".repeat(rating),
  /* @__PURE__ */ jsxs("span", { className: "text-ui-fg-muted", children: [
    "(",
    rating,
    ")"
  ] })
] });
const ResourceThumb = ({
  type,
  thumbnail,
  size = "small"
}) => {
  const box = size === "large" ? "h-12 w-12" : "h-8 w-8";
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: `flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-component`,
      children: thumbnail ? /* @__PURE__ */ jsx("img", { src: thumbnail, alt: "", className: "h-full w-full object-cover" }) : type === "blog_post" ? /* @__PURE__ */ jsx(DocumentText, { className: "text-ui-fg-muted" }) : /* @__PURE__ */ jsx(Photo, { className: "text-ui-fg-muted" })
    }
  );
};
const resourceTitle = (comment) => {
  var _a;
  return ((_a = comment.resource) == null ? void 0 : _a.title) || comment.commentable_id;
};
const openStorefront = (resource) => {
  if (resource == null ? void 0 : resource.storefront_url) {
    window.open(resource.storefront_url, "_blank", "noopener,noreferrer");
  }
};
const ResourceCell = ({ comment }) => {
  const navigate = useNavigate();
  const resource = comment.resource;
  const title = resourceTitle(comment);
  const adminPath = resource == null ? void 0 : resource.admin_path;
  return /* @__PURE__ */ jsxs("div", { className: "flex w-[280px] items-center gap-2", children: [
    /* @__PURE__ */ jsx(
      ResourceThumb,
      {
        type: comment.commentable_type,
        thumbnail: (resource == null ? void 0 : resource.thumbnail) ?? null
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
      adminPath ? /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "block max-w-full truncate text-left text-ui-fg-base hover:underline",
          title: `Abrir ${title}`,
          onClick: (e) => {
            e.stopPropagation();
            navigate(adminPath);
          },
          children: title
        }
      ) : /* @__PURE__ */ jsx("span", { className: "block truncate text-ui-fg-base", title, children: title }),
      /* @__PURE__ */ jsxs("span", { className: "block truncate text-ui-fg-muted txt-compact-xsmall", children: [
        TYPE_LABEL[comment.commentable_type],
        resource ? "" : " · no disponible",
        (resource == null ? void 0 : resource.status) === "draft" ? " · borrador" : ""
      ] })
    ] }),
    (resource == null ? void 0 : resource.storefront_url) ? /* @__PURE__ */ jsx(
      IconButton,
      {
        size: "small",
        variant: "transparent",
        className: "ml-auto shrink-0",
        title: "Ver publicación en la tienda",
        onClick: (e) => {
          e.stopPropagation();
          openStorefront(resource);
        },
        children: /* @__PURE__ */ jsx(ArrowUpRightOnBox, {})
      }
    ) : null
  ] });
};
const ResourceSummary = ({ comment }) => {
  const navigate = useNavigate();
  const resource = comment.resource;
  const isProduct = comment.commentable_type === "product";
  const title = resourceTitle(comment);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx(
        ResourceThumb,
        {
          type: comment.commentable_type,
          thumbnail: (resource == null ? void 0 : resource.thumbnail) ?? null,
          size: "large"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: TYPE_LABEL[comment.commentable_type] }),
        /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", className: "truncate", title, children: title }),
        (resource == null ? void 0 : resource.status) === "draft" ? /* @__PURE__ */ jsx(Badge, { size: "2xsmall", children: "Borrador" }) : null
      ] })
    ] }),
    resource ? /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
      resource.admin_path ? /* @__PURE__ */ jsx(
        Button,
        {
          size: "small",
          variant: "secondary",
          onClick: () => navigate(resource.admin_path),
          children: isProduct ? "Ver producto" : "Ver artículo"
        }
      ) : null,
      resource.storefront_url ? /* @__PURE__ */ jsxs(
        Button,
        {
          size: "small",
          variant: "transparent",
          onClick: () => openStorefront(resource),
          children: [
            /* @__PURE__ */ jsx(ArrowUpRightOnBox, { className: "mr-1" }),
            "Ver publicación"
          ]
        }
      ) : null
    ] }) : /* @__PURE__ */ jsxs(Text, { size: "xsmall", className: "text-ui-fg-muted", children: [
      "El recurso ya no está disponible (",
      comment.commentable_id,
      ")."
    ] })
  ] });
};
const CommentDetail = ({
  id,
  onClose,
  onAction
}) => {
  const { data } = useComment(id);
  const comment = data == null ? void 0 : data.comment;
  return /* @__PURE__ */ jsx(Drawer, { open: !!id, onOpenChange: (v) => !v && onClose(), children: /* @__PURE__ */ jsxs(Drawer.Content, { className: "z-50", children: [
    /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(Heading, { children: (comment == null ? void 0 : comment.author_name) || (comment == null ? void 0 : comment.customer_id) }),
      comment ? /* @__PURE__ */ jsx(StatusBadge, { color: STATUS_COLOR[comment.status], children: STATUS_LABEL[comment.status] }) : null
    ] }) }),
    /* @__PURE__ */ jsx(Drawer.Body, { className: "flex flex-col gap-4 overflow-y-auto", children: comment ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(ResourceSummary, { comment }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
        comment.verified_buyer ? /* @__PURE__ */ jsx(Badge, { size: "2xsmall", color: "green", children: "Comprador verificado" }) : null,
        /* @__PURE__ */ jsx(Stars, { rating: comment.rating })
      ] }),
      comment.content ? /* @__PURE__ */ jsx("div", { className: "whitespace-pre-wrap rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 text-sm", children: comment.content }) : /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Sin comentario (solo puntaje)." }),
      comment.replies && comment.replies.length > 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsxs(Text, { size: "xsmall", weight: "plus", className: "text-ui-fg-subtle", children: [
          "Respuestas (",
          comment.replies.length,
          ")"
        ] }),
        comment.replies.map((r) => /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-ui-border-base p-3", children: [
          /* @__PURE__ */ jsx(Text, { size: "xsmall", weight: "plus", children: r.author_name || r.customer_id }),
          /* @__PURE__ */ jsx(Text, { size: "small", className: "whitespace-pre-wrap", children: r.content })
        ] }, r.id))
      ] }) : null,
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2 border-ui-border-base border-t pt-3", children: [
        comment.status !== "approved" && /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => onAction(comment.id, "approve"), children: "Aprobar" }),
        comment.status !== "hidden" && /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => onAction(comment.id, "hide"), children: "Ocultar" }),
        /* @__PURE__ */ jsx(Button, { size: "small", variant: "danger", onClick: () => onAction(comment.id, "delete"), children: "Eliminar" })
      ] })
    ] }) : null })
  ] }) });
};
const columnHelper = createDataTableColumnHelper();
const CommentsList = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(void 0);
  const [type, setType] = useState(void 0);
  const [detailId, setDetailId] = useState(null);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isLoading } = useComments({
    limit: pagination.pageSize,
    offset,
    status,
    commentable_type: type
  });
  const approve = useApproveComment();
  const hide = useHideComment();
  const del = useDeleteComment();
  const items = (data == null ? void 0 : data.comments) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const runAction = async (id, action) => {
    try {
      if (action === "approve") await approve.mutateAsync(id);
      if (action === "hide") await hide.mutateAsync(id);
      if (action === "delete") await del.mutateAsync(id);
      toast.success("Comentario actualizado");
    } catch (error) {
      toast.error((error == null ? void 0 : error.message) ?? "No se pudo actualizar");
    }
  };
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "resource",
        header: "Publicación",
        cell: ({ row }) => /* @__PURE__ */ jsx(ResourceCell, { comment: row.original })
      }),
      columnHelper.accessor("author_name", {
        header: "Usuario",
        cell: ({ row }) => row.original.author_name || row.original.customer_id
      }),
      columnHelper.accessor("rating", {
        header: "Puntaje",
        cell: ({ getValue }) => /* @__PURE__ */ jsx(Stars, { rating: getValue() })
      }),
      columnHelper.accessor("content", {
        header: "Comentario",
        cell: ({ getValue }) => /* @__PURE__ */ jsx(
          "span",
          {
            className: "block max-w-[280px] truncate text-ui-fg-subtle",
            title: getValue() ?? "",
            children: getValue() || "—"
          }
        )
      }),
      columnHelper.accessor("status", {
        header: "Estado",
        cell: ({ getValue }) => /* @__PURE__ */ jsx(StatusBadge, { color: STATUS_COLOR[getValue()], children: STATUS_LABEL[getValue()] })
      }),
      columnHelper.accessor("reply_count", {
        header: "Resp.",
        cell: ({ getValue }) => getValue() ?? 0
      }),
      columnHelper.accessor("created_at", {
        header: "Fecha",
        cell: ({ getValue }) => fmtDate(getValue())
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          var _a, _b;
          return /* @__PURE__ */ jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
            /* @__PURE__ */ jsx(DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsx(IconButton, { variant: "transparent", children: /* @__PURE__ */ jsx(EllipsisHorizontal, {}) }) }),
            /* @__PURE__ */ jsxs(DropdownMenu.Content, { className: "z-[60]", children: [
              /* @__PURE__ */ jsx(DropdownMenu.Item, { onClick: () => setDetailId(row.original.id), children: "Ver detalle" }),
              ((_a = row.original.resource) == null ? void 0 : _a.admin_path) ? /* @__PURE__ */ jsx(
                DropdownMenu.Item,
                {
                  onClick: () => {
                    var _a2;
                    return navigate((_a2 = row.original.resource) == null ? void 0 : _a2.admin_path);
                  },
                  children: row.original.commentable_type === "product" ? "Ver producto" : "Ver artículo"
                }
              ) : null,
              ((_b = row.original.resource) == null ? void 0 : _b.storefront_url) ? /* @__PURE__ */ jsxs(
                DropdownMenu.Item,
                {
                  onClick: () => openStorefront(row.original.resource),
                  children: [
                    /* @__PURE__ */ jsx(ArrowUpRightOnBox, { className: "mr-2" }),
                    " Ver publicación"
                  ]
                }
              ) : null,
              /* @__PURE__ */ jsx(DropdownMenu.Separator, {}),
              /* @__PURE__ */ jsxs(DropdownMenu.Item, { onClick: () => runAction(row.original.id, "approve"), children: [
                /* @__PURE__ */ jsx(CheckCircleSolid, { className: "mr-2" }),
                " Aprobar"
              ] }),
              /* @__PURE__ */ jsxs(DropdownMenu.Item, { onClick: () => runAction(row.original.id, "hide"), children: [
                /* @__PURE__ */ jsx(EyeSlash, { className: "mr-2" }),
                " Ocultar"
              ] }),
              /* @__PURE__ */ jsxs(DropdownMenu.Item, { onClick: () => runAction(row.original.id, "delete"), children: [
                /* @__PURE__ */ jsx(Trash, { className: "mr-2" }),
                " Eliminar"
              ] })
            ] })
          ] }) });
        }
      })
    ],
    // runAction / navigate are stable enough for our needs; deps kept minimal
    // intentionally (recrear las columnas resetea el estado de la tabla).
    []
  );
  const table = useDataTable({
    columns,
    data: items,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => setDetailId(row.id)
  });
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(DataTable, { instance: table, children: [
      /* @__PURE__ */ jsxs(DataTable.Toolbar, { className: "flex flex-wrap items-center gap-3 px-6 py-4", children: [
        /* @__PURE__ */ jsx("div", { className: "w-[180px]", children: /* @__PURE__ */ jsxs(
          Select,
          {
            value: status ?? "all",
            onValueChange: (v) => {
              setStatus(v === "all" ? void 0 : v);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            },
            children: [
              /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, { placeholder: "Estado" }) }),
              /* @__PURE__ */ jsxs(Select.Content, { className: "z-[60]", children: [
                /* @__PURE__ */ jsx(Select.Item, { value: "all", children: "Todos los estados" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "pending", children: "Pendiente" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "approved", children: "Aprobado" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "hidden", children: "Oculto" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "deleted", children: "Eliminado" })
              ] })
            ]
          }
        ) }),
        /* @__PURE__ */ jsx("div", { className: "w-[180px]", children: /* @__PURE__ */ jsxs(
          Select,
          {
            value: type ?? "all",
            onValueChange: (v) => {
              setType(v === "all" ? void 0 : v);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            },
            children: [
              /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, { placeholder: "Tipo" }) }),
              /* @__PURE__ */ jsxs(Select.Content, { className: "z-[60]", children: [
                /* @__PURE__ */ jsx(Select.Item, { value: "all", children: "Todos los tipos" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "product", children: "Producto" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "blog_post", children: "Blog" })
              ] })
            ]
          }
        ) }),
        /* @__PURE__ */ jsxs(Text, { size: "small", className: "ml-auto text-ui-fg-subtle", children: [
          count,
          " ",
          count === 1 ? "comentario" : "comentarios"
        ] })
      ] }),
      count > 0 || isLoading ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(DataTable.Table, {}),
        /* @__PURE__ */ jsx(DataTable.Pagination, {})
      ] }) : /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "No hay comentarios." }) })
    ] }),
    /* @__PURE__ */ jsx(
      CommentDetail,
      {
        id: detailId,
        onClose: () => setDetailId(null),
        onAction: (id, action) => {
          runAction(id, action);
          setDetailId(null);
        }
      }
    ),
    /* @__PURE__ */ jsx(Toaster, {})
  ] });
};
const Row = ({
  label,
  hint,
  children
}) => /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5 border-ui-border-base border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between", children: [
  /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
    /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: label }),
    hint ? /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: hint }) : null
  ] }),
  /* @__PURE__ */ jsx("div", { className: "w-full sm:w-[260px]", children })
] });
const CommentsSettings = () => {
  const { data, isLoading } = useCommentSettings();
  const update = useUpdateCommentSettings();
  const [draft, setDraft] = useState({});
  useEffect(() => {
    if (data == null ? void 0 : data.settings) setDraft(data.settings);
  }, [data == null ? void 0 : data.settings]);
  if (isLoading || !(data == null ? void 0 : data.settings)) {
    return /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "…" });
  }
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const num = (key) => (e) => {
    const v = Number(e.target.value);
    set(key, Number.isFinite(v) ? v : 0);
  };
  const save = async () => {
    try {
      await update.mutateAsync(draft);
      toast.success("Configuración guardada");
    } catch (error) {
      toast.error((error == null ? void 0 : error.message) ?? "No se pudo guardar");
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "max-w-2xl", children: [
    /* @__PURE__ */ jsx(Row, { label: "Comentarios habilitados", hint: "Activar o desactivar todo el sistema.", children: /* @__PURE__ */ jsx(
      Switch,
      {
        checked: !!draft.enabled,
        onCheckedChange: (v) => set("enabled", v)
      }
    ) }),
    /* @__PURE__ */ jsx(
      Row,
      {
        label: "Modo de reseña",
        hint: "Qué se captura: solo comentario, solo puntaje o ambos.",
        children: /* @__PURE__ */ jsxs(
          Select,
          {
            value: draft.review_mode,
            onValueChange: (v) => set("review_mode", v),
            children: [
              /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, {}) }),
              /* @__PURE__ */ jsxs(Select.Content, { className: "z-[60]", children: [
                /* @__PURE__ */ jsx(Select.Item, { value: "comment", children: "Solo comentario" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "rating", children: "Solo puntaje" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "both", children: "Puntaje y comentario" })
              ] })
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      Row,
      {
        label: "Escala de puntaje",
        hint: "Puntaje máximo (ej. 5 = 1 a 5 estrellas).",
        children: /* @__PURE__ */ jsx(Input, { type: "number", min: 2, max: 10, value: draft.rating_scale ?? 5, onChange: num("rating_scale") })
      }
    ),
    /* @__PURE__ */ jsx(Row, { label: "Quién puede comentar", children: /* @__PURE__ */ jsxs(
      Select,
      {
        value: draft.who_can_comment,
        onValueChange: (v) => set("who_can_comment", v),
        children: [
          /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, {}) }),
          /* @__PURE__ */ jsxs(Select.Content, { className: "z-[60]", children: [
            /* @__PURE__ */ jsx(Select.Item, { value: "registered", children: "Usuarios registrados" }),
            /* @__PURE__ */ jsx(Select.Item, { value: "verified_buyer", children: "Solo quienes recibieron el producto (pedido entregado)" })
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx(Row, { label: "Moderación", children: /* @__PURE__ */ jsxs(
      Select,
      {
        value: draft.moderation,
        onValueChange: (v) => set("moderation", v),
        children: [
          /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, {}) }),
          /* @__PURE__ */ jsxs(Select.Content, { className: "z-[60]", children: [
            /* @__PURE__ */ jsx(Select.Item, { value: "auto", children: "Publicación automática" }),
            /* @__PURE__ */ jsx(Select.Item, { value: "manual", children: "Requiere aprobación manual" })
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx(Row, { label: "Ventana de edición (minutos)", children: /* @__PURE__ */ jsx(Input, { type: "number", min: 0, value: draft.edit_window_minutes ?? 15, onChange: num("edit_window_minutes") }) }),
    /* @__PURE__ */ jsx(Row, { label: "Longitud mínima", children: /* @__PURE__ */ jsx(Input, { type: "number", min: 0, value: draft.min_length ?? 5, onChange: num("min_length") }) }),
    /* @__PURE__ */ jsx(Row, { label: "Longitud máxima", children: /* @__PURE__ */ jsx(Input, { type: "number", min: 1, value: draft.max_length ?? 2e3, onChange: num("max_length") }) }),
    /* @__PURE__ */ jsx(Row, { label: "Límite por minuto", hint: "Comentarios por usuario por minuto.", children: /* @__PURE__ */ jsx(Input, { type: "number", min: 1, value: draft.rate_limit_per_minute ?? 5, onChange: num("rate_limit_per_minute") }) }),
    /* @__PURE__ */ jsx("div", { className: "flex justify-end pt-4", children: /* @__PURE__ */ jsx(Button, { onClick: save, isLoading: update.isPending, children: "Guardar" }) }),
    /* @__PURE__ */ jsx(Toaster, {})
  ] });
};
const CommentsPage = () => {
  return /* @__PURE__ */ jsxs(Container, { className: "p-0", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-6 py-4", children: [
      /* @__PURE__ */ jsx(Heading, { level: "h1", children: "Comentarios" }),
      /* @__PURE__ */ jsx(Badge, { size: "2xsmall", children: "v1.4.2" })
    ] }),
    /* @__PURE__ */ jsx(SiteScopeBar, { screen: "comments" }),
    /* @__PURE__ */ jsxs(Tabs, { defaultValue: "list", children: [
      /* @__PURE__ */ jsx("div", { className: "border-b border-ui-border-base px-6 pb-4 pt-1", children: /* @__PURE__ */ jsxs(Tabs.List, { children: [
        /* @__PURE__ */ jsx(Tabs.Trigger, { value: "list", children: "Listado" }),
        /* @__PURE__ */ jsx(Tabs.Trigger, { value: "config", children: "Configuración" })
      ] }) }),
      /* @__PURE__ */ jsx(Tabs.Content, { value: "list", children: /* @__PURE__ */ jsx(CommentsList, {}) }),
      /* @__PURE__ */ jsx(Tabs.Content, { value: "config", className: "px-6 py-6", children: /* @__PURE__ */ jsx(CommentsSettings, {}) })
    ] })
  ] });
};
const CommentsIcon = () => /* @__PURE__ */ jsx(ChatBubbleLeftRight, {});
const config = defineRouteConfig({
  label: "Comentarios",
  icon: CommentsIcon,
  rank: 80
});
const handle = {
  breadcrumb: () => "Comentarios"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: CommentsPage,
      path: "/comments",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/comments",
      nested: void 0,
      rank: 80,
      translationNs: void 0
    }
  ]
};
const formModule = { customFields: {} };
const displayModule = {
  displays: {}
};
const i18nModule = { resources: {} };
const cellRendererModule = {};
const layoutModule = { layouts: [] };
const plugin = {
  widgetModule,
  routeModule,
  menuItemModule,
  formModule,
  displayModule,
  i18nModule,
  cellRendererModule,
  layoutModule
};
export {
  plugin as default
};
