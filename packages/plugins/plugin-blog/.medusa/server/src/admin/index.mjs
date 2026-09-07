import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DocumentText, EllipsisHorizontal, PencilSquare, SquareTwoStack, Trash, Tag, CogSixTooth, DotsSix, ArrowLeft } from "@medusajs/icons";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { createDataTableColumnHelper, usePrompt, Text, StatusBadge, DropdownMenu, IconButton, useDataTable, Container, DataTable, Heading, Button, Toaster, toast, Drawer, Label, Input, Textarea, Switch, Tooltip, clx, FocusModal, Select } from "@medusajs/ui";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { SiteScopeBar, ExtensionVersion, SalesChannelMultiSelect } from "@minimalart/mercatto-plugin-runtime/admin";
import Medusa from "@medusajs/js-sdk";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { useSensors, useSensor, PointerSensor, DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "@medusajs/admin-shared";
const BlogIndex = () => /* @__PURE__ */ jsx(Navigate, { to: "/blog/articles", replace: true });
const BlogIcon = () => /* @__PURE__ */ jsx(DocumentText, { style: { color: "#3B82F6" } });
const config$3 = defineRouteConfig({
  label: "Blog",
  icon: BlogIcon,
  rank: 45
});
const handle$1 = {
  breadcrumb: () => "Blog"
};
const POSTS_URL = "/admin/blog-posts";
const CATEGORIES_URL = "/admin/blog-categories";
const SETTINGS_URL = "/admin/blog-settings";
const BLOG_POSTS_KEY = ["blog-posts"];
const blogPostKey = (id) => ["blog-posts", id];
const BLOG_CATEGORIES_KEY = ["blog-categories"];
const BLOG_SETTINGS_KEY = ["blog-settings"];
async function fetchJson(url, init) {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init == null ? void 0 : init.headers) ?? {} }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}
function useBlogPosts(params) {
  const qs = new URLSearchParams();
  if ((params == null ? void 0 : params.limit) != null) qs.set("limit", String(params.limit));
  if ((params == null ? void 0 : params.offset) != null) qs.set("offset", String(params.offset));
  if (params == null ? void 0 : params.status) qs.set("status", params.status);
  if (params == null ? void 0 : params.category_id) qs.set("category_id", params.category_id);
  if (params == null ? void 0 : params.q) qs.set("q", params.q);
  const url = qs.toString() ? `${POSTS_URL}?${qs.toString()}` : POSTS_URL;
  return useQuery({
    queryKey: [...BLOG_POSTS_KEY, params ?? {}],
    queryFn: () => fetchJson(url)
  });
}
function useBlogPost(id) {
  return useQuery({
    queryKey: blogPostKey(id),
    queryFn: () => fetchJson(
      `${POSTS_URL}/${id}`
    ),
    enabled: !!id
  });
}
function useCreateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => fetchJson(POSTS_URL, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.blog_post),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY })
  });
}
function useUpdateBlogPost(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => fetchJson(`${POSTS_URL}/${id}`, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.blog_post),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY });
      qc.invalidateQueries({ queryKey: blogPostKey(id) });
    }
  });
}
function useDeleteBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => fetchJson(`${POSTS_URL}/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY })
  });
}
function usePublishBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => fetchJson(`${POSTS_URL}/${id}/publish`, {
      method: "POST"
    }).then((d) => d.blog_post),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY })
  });
}
function useUnpublishBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => fetchJson(`${POSTS_URL}/${id}/unpublish`, {
      method: "POST"
    }).then((d) => d.blog_post),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY })
  });
}
function useDuplicateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => fetchJson(`${POSTS_URL}/${id}/duplicate`, {
      method: "POST"
    }).then((d) => d.blog_post),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY })
  });
}
function useBlogCategories(params) {
  const qs = new URLSearchParams();
  if ((params == null ? void 0 : params.limit) != null) qs.set("limit", String(params.limit));
  if ((params == null ? void 0 : params.offset) != null) qs.set("offset", String(params.offset));
  if (params == null ? void 0 : params.q) qs.set("q", params.q);
  const url = qs.toString() ? `${CATEGORIES_URL}?${qs.toString()}` : CATEGORIES_URL;
  return useQuery({
    queryKey: [...BLOG_CATEGORIES_KEY, params ?? {}],
    queryFn: () => fetchJson(url)
  });
}
function useCreateBlogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => fetchJson(CATEGORIES_URL, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.blog_category),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_CATEGORIES_KEY })
  });
}
function useUpdateBlogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => fetchJson(`${CATEGORIES_URL}/${id}`, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.blog_category),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_CATEGORIES_KEY })
  });
}
function useDeleteBlogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => fetchJson(`${CATEGORIES_URL}/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_CATEGORIES_KEY })
  });
}
function useBlogSettings() {
  return useQuery({
    queryKey: BLOG_SETTINGS_KEY,
    queryFn: () => fetchJson(SETTINGS_URL).then(
      (d) => d.blog_settings
    )
  });
}
function useUpdateBlogSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => fetchJson(SETTINGS_URL, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.blog_settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_SETTINGS_KEY })
  });
}
const BLOG_NAMESPACE = "blog";
let registered = false;
const en = {
  // Menu / shared
  MENU_BLOG: "Blog",
  MENU_ARTICLES: "Articles",
  MENU_CATEGORIES: "Categories",
  MENU_SETTINGS: "Settings",
  // Articles list
  ARTICLES_TITLE: "Articles",
  ARTICLES_EMPTY: "No articles yet. Create your first one.",
  CREATE_ARTICLE: "Create",
  COLUMN_TITLE: "Title",
  COLUMN_CATEGORY: "Category",
  COLUMN_STATUS: "Status",
  COLUMN_DATE: "Date",
  COLUMN_ACTIONS: "Actions",
  STATUS_DRAFT: "Draft",
  STATUS_PUBLISHED: "Published",
  ACTION_EDIT: "Edit",
  ACTION_DUPLICATE: "Duplicate",
  ACTION_DELETE: "Delete",
  ACTION_PUBLISH: "Publish",
  ACTION_UNPUBLISH: "Unpublish",
  CONFIRM_DELETE_TITLE: "Delete article",
  CONFIRM_DELETE_DESC: "This action cannot be undone.",
  NONE: "None",
  // Editor
  EDITOR_NEW_TITLE: "New article",
  EDITOR_BACK: "Back",
  EDITOR_SAVE: "Save",
  EDITOR_PREVIEW: "Preview",
  SAVE_SUCCESS: "Article saved",
  SAVE_ERROR: "Could not save: {{msg}}",
  FIELD_TITLE: "Title",
  FIELD_TITLE_PLACEHOLDER: "Article title",
  FIELD_SLUG: "Slug",
  FIELD_SLUG_HELP: "URL: /blog/{slug}. Generated from the title when empty.",
  FIELD_EXCERPT: "Excerpt",
  FIELD_EXCERPT_PLACEHOLDER: "Short summary shown in cards and listings",
  FIELD_COVER: "Cover image",
  FIELD_CONTENT: "Content",
  FIELD_CATEGORY: "Category",
  FIELD_STATUS: "Status",
  SECTION_SEO: "SEO",
  FIELD_SEO_TITLE: "SEO title",
  FIELD_SEO_DESCRIPTION: "SEO description",
  SECTION_PRODUCTS: "Related products",
  PRODUCTS_HELP: "These products appear in the article and can be added to cart.",
  PRODUCTS_ADD: "Add products",
  PRODUCTS_SEARCH: "Search products…",
  PRODUCTS_EMPTY: "No products linked yet.",
  PRODUCTS_REMOVE: "Remove",
  UPLOAD: "Upload",
  UPLOADING: "Uploading…",
  REMOVE_IMAGE: "Remove image",
  VALIDATION_TITLE_REQUIRED: "Title is required",
  // Toolbar
  TB_BOLD: "Bold",
  TB_ITALIC: "Italic",
  TB_UNDERLINE: "Underline",
  TB_STRIKE: "Strikethrough",
  TB_H1: "Heading 1",
  TB_H2: "Heading 2",
  TB_H3: "Heading 3",
  TB_PARAGRAPH: "Paragraph",
  TB_BULLET: "Bullet list",
  TB_ORDERED: "Numbered list",
  TB_TASK: "Checklist",
  TB_QUOTE: "Quote",
  TB_DIVIDER: "Divider",
  TB_LINK: "Link",
  TB_IMAGE: "Image",
  TB_VIDEO: "Embed video (YouTube/Vimeo)",
  TB_TABLE: "Table",
  TB_HIGHLIGHT: "Highlight",
  TB_COLOR: "Text color",
  PROMPT_LINK: "Enter URL",
  PROMPT_VIDEO: "Enter YouTube or Vimeo URL",
  LINK_MODAL_TITLE: "Add link",
  LINK_MODAL_SUBMIT: "Apply link",
  VIDEO_MODAL_TITLE: "Add video",
  VIDEO_MODAL_SUBMIT: "Insert video",
  // Categories
  CATEGORIES_TITLE: "Categories",
  CATEGORIES_EMPTY: "No categories yet.",
  CREATE_CATEGORY: "Create category",
  EDIT_CATEGORY: "Edit category",
  FIELD_NAME: "Name",
  FIELD_DESCRIPTION: "Description",
  FIELD_IMAGE: "Image",
  FIELD_ORDER: "Order",
  CATEGORY_SAVED: "Category saved",
  CATEGORY_DELETED: "Category deleted",
  // Settings
  SETTINGS_TITLE: "Blog settings",
  SETTINGS_GENERAL: "General",
  SETTINGS_SEO: "SEO defaults",
  FIELD_SECTION_NAME: "Section name",
  FIELD_SHOW_SEARCH: "Show search",
  FIELD_SHOW_CATEGORIES: "Show categories",
  FIELD_POSTS_PER_PAGE: "Posts per page",
  FIELD_DEFAULT_SEO_TITLE: "Default meta title",
  FIELD_DEFAULT_SEO_DESCRIPTION: "Default meta description",
  SETTINGS_SAVED: "Settings saved",
  SAVE: "Save",
  CANCEL: "Cancel"
};
const es = {
  MENU_BLOG: "Blog",
  MENU_ARTICLES: "Artículos",
  MENU_CATEGORIES: "Categorías",
  MENU_SETTINGS: "Configuración",
  ARTICLES_TITLE: "Artículos",
  ARTICLES_EMPTY: "Todavía no hay artículos. Creá el primero.",
  CREATE_ARTICLE: "Crear",
  COLUMN_TITLE: "Título",
  COLUMN_CATEGORY: "Categoría",
  COLUMN_STATUS: "Estado",
  COLUMN_DATE: "Fecha",
  COLUMN_ACTIONS: "Acciones",
  STATUS_DRAFT: "Borrador",
  STATUS_PUBLISHED: "Publicado",
  ACTION_EDIT: "Editar",
  ACTION_DUPLICATE: "Duplicar",
  ACTION_DELETE: "Eliminar",
  ACTION_PUBLISH: "Publicar",
  ACTION_UNPUBLISH: "Despublicar",
  CONFIRM_DELETE_TITLE: "Eliminar artículo",
  CONFIRM_DELETE_DESC: "Esta acción no se puede deshacer.",
  NONE: "Ninguna",
  EDITOR_NEW_TITLE: "Nuevo artículo",
  EDITOR_BACK: "Volver",
  EDITOR_SAVE: "Guardar",
  EDITOR_PREVIEW: "Vista previa",
  SAVE_SUCCESS: "Artículo guardado",
  SAVE_ERROR: "No se pudo guardar: {{msg}}",
  FIELD_TITLE: "Título",
  FIELD_TITLE_PLACEHOLDER: "Título del artículo",
  FIELD_SLUG: "Slug",
  FIELD_SLUG_HELP: "URL: /blog/{slug}. Se genera del título si se deja vacío.",
  FIELD_EXCERPT: "Extracto",
  FIELD_EXCERPT_PLACEHOLDER: "Resumen breve que se muestra en las tarjetas",
  FIELD_COVER: "Imagen de portada",
  FIELD_CONTENT: "Contenido",
  FIELD_CATEGORY: "Categoría",
  FIELD_STATUS: "Estado",
  SECTION_SEO: "SEO",
  FIELD_SEO_TITLE: "Título SEO",
  FIELD_SEO_DESCRIPTION: "Descripción SEO",
  SECTION_PRODUCTS: "Productos relacionados",
  PRODUCTS_HELP: "Estos productos aparecen en el artículo y se pueden agregar al carrito.",
  PRODUCTS_ADD: "Agregar productos",
  PRODUCTS_SEARCH: "Buscar productos…",
  PRODUCTS_EMPTY: "Todavía no hay productos vinculados.",
  PRODUCTS_REMOVE: "Quitar",
  UPLOAD: "Subir",
  UPLOADING: "Subiendo…",
  REMOVE_IMAGE: "Quitar imagen",
  VALIDATION_TITLE_REQUIRED: "El título es obligatorio",
  TB_BOLD: "Negrita",
  TB_ITALIC: "Cursiva",
  TB_UNDERLINE: "Subrayado",
  TB_STRIKE: "Tachado",
  TB_H1: "Título 1",
  TB_H2: "Título 2",
  TB_H3: "Título 3",
  TB_PARAGRAPH: "Párrafo",
  TB_BULLET: "Lista con viñetas",
  TB_ORDERED: "Lista numerada",
  TB_TASK: "Checklist",
  TB_QUOTE: "Cita",
  TB_DIVIDER: "Separador",
  TB_LINK: "Enlace",
  TB_IMAGE: "Imagen",
  TB_VIDEO: "Insertar video (YouTube/Vimeo)",
  TB_TABLE: "Tabla",
  TB_HIGHLIGHT: "Resaltar",
  TB_COLOR: "Color de texto",
  LINK_MODAL_TITLE: "Agregar enlace",
  LINK_MODAL_SUBMIT: "Aplicar enlace",
  VIDEO_MODAL_TITLE: "Agregar video",
  VIDEO_MODAL_SUBMIT: "Insertar video",
  PROMPT_LINK: "Ingresá la URL",
  PROMPT_VIDEO: "Ingresá la URL de YouTube o Vimeo",
  CATEGORIES_TITLE: "Categorías",
  CATEGORIES_EMPTY: "Todavía no hay categorías.",
  CREATE_CATEGORY: "Crear categoría",
  EDIT_CATEGORY: "Editar categoría",
  FIELD_NAME: "Nombre",
  FIELD_DESCRIPTION: "Descripción",
  FIELD_IMAGE: "Imagen",
  FIELD_ORDER: "Orden",
  CATEGORY_SAVED: "Categoría guardada",
  CATEGORY_DELETED: "Categoría eliminada",
  SETTINGS_TITLE: "Configuración del blog",
  SETTINGS_GENERAL: "Generales",
  SETTINGS_SEO: "SEO por defecto",
  FIELD_SECTION_NAME: "Nombre de sección",
  FIELD_SHOW_SEARCH: "Mostrar buscador",
  FIELD_SHOW_CATEGORIES: "Mostrar categorías",
  FIELD_POSTS_PER_PAGE: "Posts por página",
  FIELD_DEFAULT_SEO_TITLE: "Meta title por defecto",
  FIELD_DEFAULT_SEO_DESCRIPTION: "Meta description por defecto",
  SETTINGS_SAVED: "Configuración guardada",
  SAVE: "Guardar",
  CANCEL: "Cancelar"
};
const registerBlogTranslations = (i18n) => {
  if (registered) return;
  registered = true;
  i18n.addResourceBundle("en", BLOG_NAMESPACE, en);
  i18n.addResourceBundle("es", BLOG_NAMESPACE, es);
};
const PAGE_SIZE = 20;
const columnHelper$1 = createDataTableColumnHelper();
const ArticlesPage = () => {
  const { t, i18n } = useTranslation("blog");
  registerBlogTranslations(i18n);
  const navigate = useNavigate();
  const prompt = usePrompt();
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useBlogPosts({
    limit: pagination.pageSize,
    offset
  });
  const { data: catData } = useBlogCategories({ limit: 200 });
  const categoryName = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    ((catData == null ? void 0 : catData.blog_categories) ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [catData]);
  const deleteMut = useDeleteBlogPost();
  const duplicateMut = useDuplicateBlogPost();
  const publishMut = usePublishBlogPost();
  const unpublishMut = useUnpublishBlogPost();
  const handleDelete = async (post) => {
    const confirmed = await prompt({
      title: t("CONFIRM_DELETE_TITLE"),
      description: t("CONFIRM_DELETE_DESC"),
      confirmText: t("ACTION_DELETE"),
      cancelText: "Cancelar"
    });
    if (!confirmed) return;
    await deleteMut.mutateAsync(post.id);
    toast.success(t("ACTION_DELETE"));
  };
  const columns = useMemo(
    () => [
      columnHelper$1.accessor("title", {
        header: t("COLUMN_TITLE"),
        cell: ({ getValue }) => /* @__PURE__ */ jsx("span", { className: "font-medium", children: getValue() })
      }),
      columnHelper$1.accessor("category_id", {
        header: t("COLUMN_CATEGORY"),
        cell: ({ getValue }) => {
          const id = getValue();
          return /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: id ? categoryName.get(id) ?? "—" : "—" });
        }
      }),
      columnHelper$1.accessor("status", {
        header: t("COLUMN_STATUS"),
        cell: ({ getValue }) => {
          const published = getValue() === "published";
          return /* @__PURE__ */ jsx(StatusBadge, { color: published ? "green" : "grey", children: published ? t("STATUS_PUBLISHED") : t("STATUS_DRAFT") });
        }
      }),
      columnHelper$1.accessor("published_at", {
        header: t("COLUMN_DATE"),
        cell: ({ row }) => {
          const d = row.original.published_at ?? row.original.created_at;
          return /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: d ? new Date(d).toLocaleDateString() : "—" });
        }
      }),
      columnHelper$1.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const post = row.original;
          return /* @__PURE__ */ jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
            /* @__PURE__ */ jsx(DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsx(IconButton, { variant: "transparent", size: "small", children: /* @__PURE__ */ jsx(EllipsisHorizontal, {}) }) }),
            /* @__PURE__ */ jsxs(DropdownMenu.Content, { children: [
              /* @__PURE__ */ jsxs(
                DropdownMenu.Item,
                {
                  onClick: () => navigate(`/blog/articles/${post.id}`),
                  children: [
                    /* @__PURE__ */ jsx(PencilSquare, { className: "mr-2" }),
                    t("ACTION_EDIT")
                  ]
                }
              ),
              post.status === "published" ? /* @__PURE__ */ jsx(
                DropdownMenu.Item,
                {
                  onClick: () => unpublishMut.mutate(post.id),
                  children: t("ACTION_UNPUBLISH")
                }
              ) : /* @__PURE__ */ jsx(
                DropdownMenu.Item,
                {
                  onClick: () => publishMut.mutate(post.id),
                  children: t("ACTION_PUBLISH")
                }
              ),
              /* @__PURE__ */ jsxs(
                DropdownMenu.Item,
                {
                  onClick: () => duplicateMut.mutate(post.id),
                  children: [
                    /* @__PURE__ */ jsx(SquareTwoStack, { className: "mr-2" }),
                    t("ACTION_DUPLICATE")
                  ]
                }
              ),
              /* @__PURE__ */ jsx(DropdownMenu.Separator, {}),
              /* @__PURE__ */ jsxs(DropdownMenu.Item, { onClick: () => handleDelete(post), children: [
                /* @__PURE__ */ jsx(Trash, { className: "mr-2" }),
                t("ACTION_DELETE")
              ] })
            ] })
          ] }) });
        }
      })
    ],
    [t, categoryName]
  );
  const posts = (data == null ? void 0 : data.blog_posts) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const table = useDataTable({
    columns,
    data: posts,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => navigate(`/blog/articles/${row.id}`)
  });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(SiteScopeBar, { screen: "blog" }),
    /* @__PURE__ */ jsxs(Container, { className: "p-0", children: [
      /* @__PURE__ */ jsxs(DataTable, { instance: table, children: [
        /* @__PURE__ */ jsxs(DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-2", children: [
            /* @__PURE__ */ jsx(Heading, { children: t("ARTICLES_TITLE") }),
            /* @__PURE__ */ jsx(ExtensionVersion, { extension: "blog" })
          ] }),
          /* @__PURE__ */ jsx(
            Button,
            {
              size: "small",
              variant: "secondary",
              onClick: () => navigate("/blog/articles/new"),
              children: t("CREATE_ARTICLE")
            }
          )
        ] }),
        count > 0 || isPending ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(DataTable.Table, {}),
          /* @__PURE__ */ jsx(DataTable.Pagination, {})
        ] }) : /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: t("ARTICLES_EMPTY") }) })
      ] }),
      /* @__PURE__ */ jsx(Toaster, {})
    ] })
  ] });
};
const ArticlesIcon = () => /* @__PURE__ */ jsx(DocumentText, {});
const config$2 = defineRouteConfig({
  label: "Artículos",
  icon: ArticlesIcon
});
const sdk = new Medusa({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const columnHelper = createDataTableColumnHelper();
const CategoriesPage = () => {
  const { t, i18n } = useTranslation("blog");
  registerBlogTranslations(i18n);
  const prompt = usePrompt();
  const { data, isPending } = useBlogCategories({ limit: 200 });
  const deleteMut = useDeleteBlogCategory();
  const [editing, setEditing] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const handleDelete = async (cat) => {
    const ok = await prompt({
      title: t("CONFIRM_DELETE_TITLE"),
      description: t("CONFIRM_DELETE_DESC"),
      confirmText: "Eliminar",
      cancelText: "Cancelar"
    });
    if (!ok) return;
    await deleteMut.mutateAsync(cat.id);
    toast.success(t("CATEGORY_DELETED"));
  };
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: t("FIELD_NAME"),
        cell: ({ getValue }) => /* @__PURE__ */ jsx("span", { className: "font-medium", children: getValue() })
      }),
      columnHelper.accessor("slug", {
        header: t("FIELD_SLUG"),
        cell: ({ getValue }) => /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: getValue() })
      }),
      columnHelper.accessor("sort_order", {
        header: t("FIELD_ORDER"),
        cell: ({ getValue }) => /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: getValue() })
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => /* @__PURE__ */ jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
          /* @__PURE__ */ jsx(DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsx(IconButton, { variant: "transparent", size: "small", children: /* @__PURE__ */ jsx(EllipsisHorizontal, {}) }) }),
          /* @__PURE__ */ jsxs(DropdownMenu.Content, { children: [
            /* @__PURE__ */ jsxs(DropdownMenu.Item, { onClick: () => setEditing(row.original), children: [
              /* @__PURE__ */ jsx(PencilSquare, { className: "mr-2" }),
              t("ACTION_EDIT")
            ] }),
            /* @__PURE__ */ jsx(DropdownMenu.Separator, {}),
            /* @__PURE__ */ jsxs(DropdownMenu.Item, { onClick: () => handleDelete(row.original), children: [
              /* @__PURE__ */ jsx(Trash, { className: "mr-2" }),
              t("ACTION_DELETE")
            ] })
          ] })
        ] }) })
      })
    ],
    [t]
  );
  const categories = (data == null ? void 0 : data.blog_categories) ?? [];
  const table = useDataTable({
    columns,
    data: categories,
    getRowId: (row) => row.id,
    rowCount: (data == null ? void 0 : data.count) ?? 0,
    isLoading: isPending,
    onRowClick: (_e, row) => setEditing(row)
  });
  return /* @__PURE__ */ jsxs(Container, { className: "p-0", children: [
    /* @__PURE__ */ jsxs(DataTable, { instance: table, children: [
      /* @__PURE__ */ jsxs(DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: [
        /* @__PURE__ */ jsx(Heading, { children: t("CATEGORIES_TITLE") }),
        /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => setCreateOpen(true), children: t("CREATE_CATEGORY") })
      ] }),
      categories.length > 0 || isPending ? /* @__PURE__ */ jsx(DataTable.Table, {}) : /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: t("CATEGORIES_EMPTY") }) })
    ] }),
    /* @__PURE__ */ jsx(CategoryDrawer, { open: createOpen, onOpenChange: setCreateOpen }),
    editing && /* @__PURE__ */ jsx(
      CategoryDrawer,
      {
        category: editing,
        open: !!editing,
        onOpenChange: (o) => !o && setEditing(null)
      }
    ),
    /* @__PURE__ */ jsx(Toaster, {})
  ] });
};
function CategoryDrawer({
  category,
  open,
  onOpenChange
}) {
  const { t } = useTranslation("blog");
  const isEdit = !!category;
  const createMut = useCreateBlogCategory();
  const updateMut = useUpdateBlogCategory();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [sortOrder, setSortOrder] = useState("0");
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (open) {
      setName((category == null ? void 0 : category.name) ?? "");
      setSlug((category == null ? void 0 : category.slug) ?? "");
      setDescription((category == null ? void 0 : category.description) ?? "");
      setImage((category == null ? void 0 : category.image) ?? null);
      setSortOrder(String((category == null ? void 0 : category.sort_order) ?? 0));
    }
  }, [open, category]);
  const handleUpload = async (file) => {
    var _a;
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const f = (_a = res.files) == null ? void 0 : _a[0];
      if (f == null ? void 0 : f.url) setImage({ url: f.url, file_id: f.id, alt: name });
    } finally {
      setUploading(false);
    }
  };
  const isPending = createMut.isPending || updateMut.isPending;
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("VALIDATION_TITLE_REQUIRED"));
      return;
    }
    const payload = {
      name: name.trim(),
      slug: slug.trim() || void 0,
      description: description || null,
      image,
      sort_order: Number(sortOrder) || 0
    };
    try {
      if (isEdit && category) {
        await updateMut.mutateAsync({ id: category.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      toast.success(t("CATEGORY_SAVED"));
      onOpenChange(false);
    } catch (e) {
      toast.error(t("SAVE_ERROR", { msg: (e == null ? void 0 : e.message) ?? "" }));
    }
  };
  return /* @__PURE__ */ jsx(Drawer, { open, onOpenChange, children: /* @__PURE__ */ jsxs(Drawer.Content, { children: [
    /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsx(Drawer.Title, { children: isEdit ? t("EDIT_CATEGORY") : t("CREATE_CATEGORY") }) }),
    /* @__PURE__ */ jsxs(Drawer.Body, { className: "flex flex-col gap-4 overflow-y-auto", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_NAME") }),
        /* @__PURE__ */ jsx(Input, { value: name, onChange: (e) => setName(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_SLUG") }),
        /* @__PURE__ */ jsx(Input, { value: slug, onChange: (e) => setSlug(e.target.value), placeholder: "auto" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_DESCRIPTION") }),
        /* @__PURE__ */ jsx(Textarea, { value: description, onChange: (e) => setDescription(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_ORDER") }),
        /* @__PURE__ */ jsx(
          Input,
          {
            type: "number",
            value: sortOrder,
            onChange: (e) => setSortOrder(e.target.value)
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_IMAGE") }),
        (image == null ? void 0 : image.url) ? /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-lg border border-ui-border-base", children: /* @__PURE__ */ jsx("img", { src: image.url, alt: "", className: "h-28 w-full object-cover" }) }) : null,
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsxs("label", { className: "inline-flex", children: [
            /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "small", asChild: true, children: /* @__PURE__ */ jsx("span", { children: uploading ? t("UPLOADING") : t("UPLOAD") }) }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "file",
                accept: "image/*",
                className: "hidden",
                disabled: uploading,
                onChange: (e) => {
                  var _a;
                  const f = (_a = e.target.files) == null ? void 0 : _a[0];
                  if (f) handleUpload(f);
                  e.currentTarget.value = "";
                }
              }
            )
          ] }),
          (image == null ? void 0 : image.url) ? /* @__PURE__ */ jsx(Button, { variant: "transparent", size: "small", onClick: () => setImage(null), children: t("REMOVE_IMAGE") }) : null
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Drawer.Footer, { children: [
      /* @__PURE__ */ jsx(Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsx(Button, { variant: "secondary", children: t("CANCEL") }) }),
      /* @__PURE__ */ jsx(Button, { onClick: handleSubmit, isLoading: isPending, children: t("SAVE") })
    ] })
  ] }) });
}
const CategoriesIcon = () => /* @__PURE__ */ jsx(Tag, {});
const config$1 = defineRouteConfig({
  label: "Categorías",
  icon: CategoriesIcon
});
const SettingsPage = () => {
  const { t, i18n } = useTranslation("blog");
  registerBlogTranslations(i18n);
  const { data, isLoading } = useBlogSettings();
  const updateMut = useUpdateBlogSettings();
  const [sectionName, setSectionName] = useState("Blog");
  const [showSearch, setShowSearch] = useState(true);
  const [showCategories, setShowCategories] = useState(true);
  const [postsPerPage, setPostsPerPage] = useState("12");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  useEffect(() => {
    if (!data) return;
    setSectionName(data.section_name ?? "Blog");
    setShowSearch(data.show_search);
    setShowCategories(data.show_categories);
    setPostsPerPage(String(data.posts_per_page ?? 12));
    setSeoTitle(data.default_seo_title ?? "");
    setSeoDescription(data.default_seo_description ?? "");
  }, [data]);
  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        section_name: sectionName.trim() || "Blog",
        show_search: showSearch,
        show_categories: showCategories,
        posts_per_page: Number(postsPerPage) || 12,
        default_seo_title: seoTitle || null,
        default_seo_description: seoDescription || null
      });
      toast.success(t("SETTINGS_SAVED"));
    } catch (e) {
      toast.error(t("SAVE_ERROR", { msg: (e == null ? void 0 : e.message) ?? "" }));
    }
  };
  if (isLoading) {
    return /* @__PURE__ */ jsx(Container, { children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "…" }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
    /* @__PURE__ */ jsxs(Container, { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx(Heading, { children: t("SETTINGS_TITLE") }),
      /* @__PURE__ */ jsx(Button, { size: "small", onClick: handleSave, isLoading: updateMut.isPending, children: t("SAVE") })
    ] }),
    /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-4", children: [
      /* @__PURE__ */ jsx(Heading, { level: "h3", children: t("SETTINGS_GENERAL") }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_SECTION_NAME") }),
        /* @__PURE__ */ jsx(Input, { value: sectionName, onChange: (e) => setSectionName(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", children: t("FIELD_SHOW_SEARCH") }),
        /* @__PURE__ */ jsx(Switch, { checked: showSearch, onCheckedChange: setShowSearch })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", children: t("FIELD_SHOW_CATEGORIES") }),
        /* @__PURE__ */ jsx(Switch, { checked: showCategories, onCheckedChange: setShowCategories })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_POSTS_PER_PAGE") }),
        /* @__PURE__ */ jsx(
          Input,
          {
            type: "number",
            value: postsPerPage,
            onChange: (e) => setPostsPerPage(e.target.value)
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-4", children: [
      /* @__PURE__ */ jsx(Heading, { level: "h3", children: t("SETTINGS_SEO") }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_DEFAULT_SEO_TITLE") }),
        /* @__PURE__ */ jsx(Input, { value: seoTitle, onChange: (e) => setSeoTitle(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_DEFAULT_SEO_DESCRIPTION") }),
        /* @__PURE__ */ jsx(Textarea, { value: seoDescription, onChange: (e) => setSeoDescription(e.target.value) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Toaster, {})
  ] });
};
const SettingsIcon = () => /* @__PURE__ */ jsx(CogSixTooth, {});
const config = defineRouteConfig({
  label: "Configuración",
  icon: SettingsIcon
});
function getBlogEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] }
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false, autolink: true }),
    Image,
    Youtube.configure({ controls: true, nocookie: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell
  ];
}
const TiptapEditor = ({ value, onChange }) => {
  const { t } = useTranslation("blog");
  const lastEmitted = useRef(null);
  const editor = useEditor({
    // React 18 + StrictMode (Vite del admin) monta/desmonta dos veces; sin esto
    // el editor puede quedar destruido y los comandos del toolbar no aplican.
    immediatelyRender: false,
    extensions: getBlogEditorExtensions(),
    content: value ?? "",
    onUpdate: ({ editor: editor2 }) => {
      const json = editor2.getJSON();
      lastEmitted.current = JSON.stringify(json);
      onChange(json);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[320px] px-4 py-3"
      }
    }
  });
  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? null;
    const incomingStr = JSON.stringify(incoming);
    if (incomingStr === lastEmitted.current) return;
    if (incomingStr === JSON.stringify(editor.getJSON())) return;
    lastEmitted.current = incomingStr;
    editor.commands.setContent(incoming ?? "", false);
  }, [value, editor]);
  const uploadImage = useCallback(
    async (file) => {
      var _a, _b;
      if (!editor) return;
      try {
        const res = await sdk.admin.upload.create({ files: [file] });
        const url = (_b = (_a = res.files) == null ? void 0 : _a[0]) == null ? void 0 : _b.url;
        if (url) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      } catch {
      }
    },
    [editor]
  );
  if (!editor) {
    return null;
  }
  return /* @__PURE__ */ jsxs("div", { className: "blog-tiptap rounded-lg border border-ui-border-base bg-ui-bg-field", children: [
    /* @__PURE__ */ jsx("style", { children: `
        .blog-tiptap .ProseMirror h1{font-size:1.75rem;line-height:1.25;font-weight:700;margin:.7em 0 .35em;}
        .blog-tiptap .ProseMirror h2{font-size:1.4rem;line-height:1.3;font-weight:700;margin:.7em 0 .35em;}
        .blog-tiptap .ProseMirror h3{font-size:1.15rem;line-height:1.35;font-weight:600;margin:.6em 0 .3em;}
        .blog-tiptap .ProseMirror p{margin:.45em 0;}
        .blog-tiptap .ProseMirror ul{list-style:disc;padding-left:1.5rem;margin:.45em 0;}
        .blog-tiptap .ProseMirror ol{list-style:decimal;padding-left:1.5rem;margin:.45em 0;}
        .blog-tiptap .ProseMirror ul[data-type="taskList"]{list-style:none;padding-left:.25rem;}
        .blog-tiptap .ProseMirror ul[data-type="taskList"] li{display:flex;gap:.5rem;align-items:flex-start;}
        .blog-tiptap .ProseMirror blockquote{border-left:3px solid var(--border-strong,#d4d4d8);padding-left:.75rem;color:#6b7280;margin:.5em 0;font-style:italic;}
        .blog-tiptap .ProseMirror a{color:var(--fg-interactive,#2563eb);text-decoration:underline;}
        .blog-tiptap .ProseMirror img{max-width:100%;height:auto;border-radius:.5rem;}
        .blog-tiptap .ProseMirror hr{border:0;border-top:1px solid var(--border-base,#e5e7eb);margin:1em 0;}
        .blog-tiptap .ProseMirror table{border-collapse:collapse;width:100%;margin:.5em 0;}
        .blog-tiptap .ProseMirror th,.blog-tiptap .ProseMirror td{border:1px solid var(--border-base,#e5e7eb);padding:.35rem .5rem;}
        .blog-tiptap .ProseMirror th{background:var(--bg-subtle,#f4f4f5);font-weight:600;}
      ` }),
    /* @__PURE__ */ jsx(Toolbar, { editor, onUploadImage: uploadImage }),
    /* @__PURE__ */ jsx(EditorContent, { editor })
  ] });
};
function Toolbar({ editor, onUploadImage }) {
  const { t } = useTranslation("blog");
  const [urlDialog, setUrlDialog] = useState(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: editor2 }) => ({
      bold: editor2.isActive("bold"),
      italic: editor2.isActive("italic"),
      underline: editor2.isActive("underline"),
      strike: editor2.isActive("strike"),
      h1: editor2.isActive("heading", { level: 1 }),
      h2: editor2.isActive("heading", { level: 2 }),
      h3: editor2.isActive("heading", { level: 3 }),
      bulletList: editor2.isActive("bulletList"),
      orderedList: editor2.isActive("orderedList"),
      taskList: editor2.isActive("taskList"),
      blockquote: editor2.isActive("blockquote"),
      highlight: editor2.isActive("highlight"),
      link: editor2.isActive("link")
    })
  });
  const Btn = ({
    label,
    active,
    onClick,
    children
  }) => /* @__PURE__ */ jsx(Tooltip, { content: label, children: /* @__PURE__ */ jsx(
    IconButton,
    {
      type: "button",
      size: "small",
      variant: "transparent",
      onMouseDown: (e) => e.preventDefault(),
      onClick,
      className: clx("text-sm font-medium", {
        "bg-ui-bg-base-pressed": active
      }),
      children
    }
  ) });
  const setLink = () => {
    setUrlDialog({
      kind: "link",
      value: editor.getAttributes("link").href ?? ""
    });
  };
  const addVideo = () => {
    setUrlDialog({ kind: "video", value: "" });
  };
  const handleUrlSubmit = (url) => {
    const trimmed = url.trim();
    if ((urlDialog == null ? void 0 : urlDialog.kind) === "link") {
      if (trimmed) {
        editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
      } else {
        editor.chain().focus().unsetLink().run();
      }
      setUrlDialog(null);
      return;
    }
    if ((urlDialog == null ? void 0 : urlDialog.kind) === "video" && trimmed) {
      editor.chain().focus().setYoutubeVideo({ src: trimmed }).run();
    }
    setUrlDialog(null);
  };
  const dialogTitle = (urlDialog == null ? void 0 : urlDialog.kind) === "link" ? t("LINK_MODAL_TITLE") : t("VIDEO_MODAL_TITLE");
  const dialogLabel = (urlDialog == null ? void 0 : urlDialog.kind) === "link" ? t("PROMPT_LINK") : t("PROMPT_VIDEO");
  const dialogSubmit = (urlDialog == null ? void 0 : urlDialog.kind) === "link" ? t("LINK_MODAL_SUBMIT") : t("VIDEO_MODAL_SUBMIT");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-0.5 border-b border-ui-border-base px-2 py-1.5", children: [
      /* @__PURE__ */ jsx(Btn, { label: t("TB_BOLD"), active: state == null ? void 0 : state.bold, onClick: () => editor.chain().focus().toggleBold().run(), children: /* @__PURE__ */ jsx("span", { className: "font-bold", children: "B" }) }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_ITALIC"), active: state == null ? void 0 : state.italic, onClick: () => editor.chain().focus().toggleItalic().run(), children: /* @__PURE__ */ jsx("span", { className: "italic", children: "I" }) }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_UNDERLINE"), active: state == null ? void 0 : state.underline, onClick: () => editor.chain().focus().toggleUnderline().run(), children: /* @__PURE__ */ jsx("span", { className: "underline", children: "U" }) }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_STRIKE"), active: state == null ? void 0 : state.strike, onClick: () => editor.chain().focus().toggleStrike().run(), children: /* @__PURE__ */ jsx("span", { className: "line-through", children: "S" }) }),
      /* @__PURE__ */ jsx(Divider, {}),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_H1"), active: state == null ? void 0 : state.h1, onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), children: "H1" }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_H2"), active: state == null ? void 0 : state.h2, onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), children: "H2" }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_H3"), active: state == null ? void 0 : state.h3, onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), children: "H3" }),
      /* @__PURE__ */ jsx(Divider, {}),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_BULLET"), active: state == null ? void 0 : state.bulletList, onClick: () => editor.chain().focus().toggleBulletList().run(), children: "•" }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_ORDERED"), active: state == null ? void 0 : state.orderedList, onClick: () => editor.chain().focus().toggleOrderedList().run(), children: "1." }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_TASK"), active: state == null ? void 0 : state.taskList, onClick: () => editor.chain().focus().toggleTaskList().run(), children: "☑" }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_QUOTE"), active: state == null ? void 0 : state.blockquote, onClick: () => editor.chain().focus().toggleBlockquote().run(), children: "”" }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_DIVIDER"), onClick: () => editor.chain().focus().setHorizontalRule().run(), children: "—" }),
      /* @__PURE__ */ jsx(Divider, {}),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_HIGHLIGHT"), active: state == null ? void 0 : state.highlight, onClick: () => editor.chain().focus().toggleHighlight().run(), children: /* @__PURE__ */ jsx("span", { className: "bg-yellow-200 px-0.5", children: "H" }) }),
      /* @__PURE__ */ jsx("label", { className: "flex h-7 w-7 cursor-pointer items-center justify-center", title: t("TB_COLOR"), children: /* @__PURE__ */ jsx(
        "input",
        {
          type: "color",
          className: "h-4 w-4 cursor-pointer border-0 bg-transparent p-0",
          onChange: (e) => editor.chain().focus().setColor(e.target.value).run()
        }
      ) }),
      /* @__PURE__ */ jsx(Divider, {}),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_LINK"), active: state == null ? void 0 : state.link, onClick: setLink, children: "🔗" }),
      /* @__PURE__ */ jsxs("label", { className: "flex h-7 w-7 cursor-pointer items-center justify-center", title: t("TB_IMAGE"), children: [
        "🖼",
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "file",
            accept: "image/*",
            className: "hidden",
            onChange: (e) => {
              var _a;
              const file = (_a = e.target.files) == null ? void 0 : _a[0];
              if (file) onUploadImage(file);
              e.currentTarget.value = "";
            }
          }
        )
      ] }),
      /* @__PURE__ */ jsx(Btn, { label: t("TB_VIDEO"), onClick: addVideo, children: "▶" }),
      /* @__PURE__ */ jsx(
        Btn,
        {
          label: t("TB_TABLE"),
          onClick: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
          children: "▦"
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      UrlFocusModal,
      {
        open: !!urlDialog,
        title: dialogTitle,
        label: dialogLabel,
        submitLabel: dialogSubmit,
        initialValue: (urlDialog == null ? void 0 : urlDialog.value) ?? "",
        onOpenChange: (open) => {
          if (!open) setUrlDialog(null);
        },
        onSubmit: handleUrlSubmit
      }
    )
  ] });
}
function UrlFocusModal({
  open,
  title,
  label,
  submitLabel,
  initialValue,
  onOpenChange,
  onSubmit
}) {
  const { t } = useTranslation("blog");
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [initialValue, open]);
  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(value);
  };
  return /* @__PURE__ */ jsx(FocusModal, { open, onOpenChange, children: /* @__PURE__ */ jsx(FocusModal.Content, { className: "max-w-xl", children: /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
    /* @__PURE__ */ jsx(FocusModal.Header, { children: /* @__PURE__ */ jsx(FocusModal.Title, { children: title }) }),
    /* @__PURE__ */ jsxs(FocusModal.Body, { className: "flex flex-col gap-2 px-6 py-4", children: [
      /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", htmlFor: "blog-editor-url", children: label }),
      /* @__PURE__ */ jsx(
        Input,
        {
          id: "blog-editor-url",
          autoFocus: true,
          value,
          onChange: (event) => setValue(event.target.value)
        }
      )
    ] }),
    /* @__PURE__ */ jsx(FocusModal.Footer, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-2", children: [
      /* @__PURE__ */ jsx(Button, { type: "button", variant: "secondary", onClick: () => onOpenChange(false), children: t("CANCEL") }),
      /* @__PURE__ */ jsx(Button, { type: "submit", children: submitLabel })
    ] }) })
  ] }) }) });
}
const Divider = () => /* @__PURE__ */ jsx("span", { className: "mx-1 h-5 w-px bg-ui-border-base" });
const ProductSelector = ({ value, onChange }) => {
  const { t } = useTranslation("blog");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const { data: searchData } = useQuery({
    queryKey: ["blog-product-search", debounced],
    queryFn: () => sdk.admin.product.list({
      q: debounced,
      limit: 8,
      fields: "id,title,thumbnail"
    }),
    enabled: debounced.length > 0
  });
  const { data: selectedData } = useQuery({
    queryKey: ["blog-product-selected", value],
    queryFn: () => sdk.admin.product.list({
      id: value,
      limit: value.length,
      fields: "id,title,thumbnail"
    }),
    enabled: value.length > 0
  });
  const selectedProducts = useMemo(() => {
    const byId = new Map(
      ((selectedData == null ? void 0 : selectedData.products) ?? []).map((p) => [
        p.id,
        { id: p.id, title: p.title, thumbnail: p.thumbnail }
      ])
    );
    return value.map(
      (id) => byId.get(id) ?? { id, title: id, thumbnail: null }
    );
  }, [value, selectedData]);
  const sensors = useSensors(useSensor(PointerSensor));
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = value.indexOf(active.id);
      const newIndex = value.indexOf(over.id);
      onChange(arrayMove(value, oldIndex, newIndex));
    }
  };
  const add = (id) => {
    if (!value.includes(id)) {
      onChange([...value, id]);
    }
    setSearch("");
    setDebounced("");
  };
  const remove = (id) => onChange(value.filter((v) => v !== id));
  const results = ((searchData == null ? void 0 : searchData.products) ?? []).filter(
    (p) => !value.includes(p.id)
  );
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx(
        Input,
        {
          placeholder: t("PRODUCTS_SEARCH"),
          value: search,
          onChange: (e) => setSearch(e.target.value)
        }
      ),
      debounced && results.length > 0 && /* @__PURE__ */ jsx("div", { className: "absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout", children: results.map((p) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => add(p.id),
          className: "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ui-bg-base-hover",
          children: [
            /* @__PURE__ */ jsx(Thumb, { src: p.thumbnail }),
            /* @__PURE__ */ jsx(Text, { size: "small", children: p.title })
          ]
        },
        p.id
      )) })
    ] }),
    value.length === 0 ? /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-muted", children: t("PRODUCTS_EMPTY") }) : /* @__PURE__ */ jsx(
      DndContext,
      {
        sensors,
        collisionDetection: closestCenter,
        onDragEnd: handleDragEnd,
        children: /* @__PURE__ */ jsx(SortableContext, { items: value, strategy: verticalListSortingStrategy, children: /* @__PURE__ */ jsx("ul", { className: "flex flex-col gap-2", children: selectedProducts.map((p) => /* @__PURE__ */ jsx(
          SortableRow,
          {
            product: p,
            onRemove: () => remove(p.id),
            removeLabel: t("PRODUCTS_REMOVE")
          },
          p.id
        )) }) })
      }
    )
  ] });
};
function SortableRow({
  product,
  onRemove,
  removeLabel
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  return /* @__PURE__ */ jsxs(
    "li",
    {
      ref: setNodeRef,
      style: { transform: CSS.Transform.toString(transform), transition },
      className: clx(
        "flex items-center gap-2 rounded-lg border border-ui-border-base bg-ui-bg-base px-2 py-1.5",
        { "opacity-60": isDragging }
      ),
      children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "cursor-grab text-ui-fg-muted",
            ...attributes,
            ...listeners,
            children: /* @__PURE__ */ jsx(DotsSix, {})
          }
        ),
        /* @__PURE__ */ jsx(Thumb, { src: product.thumbnail }),
        /* @__PURE__ */ jsx(Text, { size: "small", className: "flex-1 truncate", children: product.title }),
        /* @__PURE__ */ jsx(
          Button,
          {
            type: "button",
            variant: "transparent",
            size: "small",
            onClick: onRemove,
            title: removeLabel,
            children: /* @__PURE__ */ jsx(Trash, { className: "text-ui-fg-muted" })
          }
        )
      ]
    }
  );
}
function Thumb({ src }) {
  return /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-ui-bg-component", children: src ? /* @__PURE__ */ jsx("img", { src, alt: "", className: "h-full w-full object-cover" }) : null });
}
const __vite_import_meta_env__ = {};
const getStorefrontUrlFallback = () => {
  var _a;
  const env = __vite_import_meta_env__;
  return (((_a = env == null ? void 0 : env.VITE_STOREFRONT_URL) == null ? void 0 : _a.trim()) || "http://localhost:3000").replace(/\/+$/, "");
};
async function setProducts(postId, productIds) {
  await fetch(`/admin/blog-posts/${postId}/products`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_ids: productIds })
  });
}
const ArticleEditor = () => {
  const { t, i18n } = useTranslation("blog");
  registerBlogTranslations(i18n);
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const isNew = id === "new";
  const { data, isLoading } = useBlogPost(isNew ? "" : id);
  const { data: catData } = useBlogCategories({ limit: 200 });
  const createMut = useCreateBlogPost();
  const updateMut = useUpdateBlogPost(id);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImage, setCoverImage] = useState(null);
  const [content, setContent] = useState(null);
  const [status, setStatus] = useState("draft");
  const [categoryId, setCategoryId] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [productIds, setProductIds] = useState([]);
  const [salesChannelIds, setSalesChannelIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storefrontUrl, setStorefrontUrl] = useState(getStorefrontUrlFallback());
  useEffect(() => {
    if (isNew || !data) return;
    const p = data.blog_post;
    setTitle(p.title ?? "");
    setSlug(p.slug ?? "");
    setExcerpt(p.excerpt ?? "");
    setCoverImage(p.cover_image ?? null);
    setContent(p.content ?? null);
    setStatus(p.status ?? "draft");
    setCategoryId(p.category_id ?? "");
    setSeoTitle(p.seo_title ?? "");
    setSeoDescription(p.seo_description ?? "");
    setProductIds(data.product_ids ?? []);
    setSalesChannelIds(p.sales_channel_ids ?? []);
  }, [data, isNew]);
  useEffect(() => {
    fetch("/admin/store-config/storefront-url", { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((d) => {
      if (d == null ? void 0 : d.url) setStorefrontUrl(String(d.url).replace(/\/+$/, ""));
    }).catch(() => void 0);
  }, []);
  const handleCover = async (file) => {
    var _a;
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const f = (_a = res.files) == null ? void 0 : _a[0];
      if (f == null ? void 0 : f.url) setCoverImage({ url: f.url, file_id: f.id, alt: title });
    } catch (e) {
      toast.error(t("SAVE_ERROR", { msg: (e == null ? void 0 : e.message) ?? "" }));
    } finally {
      setUploading(false);
    }
  };
  const buildPayload = () => ({
    title: title.trim(),
    slug: slug.trim() || void 0,
    excerpt: excerpt || null,
    cover_image: coverImage,
    content,
    status,
    category_id: categoryId || null,
    seo_title: seoTitle || null,
    seo_description: seoDescription || null,
    sales_channel_ids: salesChannelIds.length ? salesChannelIds : null
  });
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(t("VALIDATION_TITLE_REQUIRED"));
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await createMut.mutateAsync(buildPayload());
        await setProducts(created.id, productIds);
        toast.success(t("SAVE_SUCCESS"));
        navigate(`/blog/articles/${created.id}`, { replace: true });
        return created.slug;
      }
      const updated = await updateMut.mutateAsync(buildPayload());
      await setProducts(id, productIds);
      toast.success(t("SAVE_SUCCESS"));
      return updated.slug;
    } catch (e) {
      toast.error(t("SAVE_ERROR", { msg: (e == null ? void 0 : e.message) ?? "" }));
      return void 0;
    } finally {
      setSaving(false);
    }
  };
  const handlePreview = async () => {
    const savedSlug = await handleSave();
    const target = savedSlug || slug;
    if (target) {
      window.open(`${storefrontUrl}/blog/${target}?preview=1`, "_blank");
    }
  };
  if (!isNew && isLoading) {
    return /* @__PURE__ */ jsx(Container, { children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "…" }) });
  }
  const categories = (catData == null ? void 0 : catData.blog_categories) ?? [];
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
    /* @__PURE__ */ jsxs(Container, { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Button, { variant: "transparent", size: "small", onClick: () => navigate("/blog/articles"), children: /* @__PURE__ */ jsx(ArrowLeft, {}) }),
        /* @__PURE__ */ jsx(Heading, { children: isNew ? t("EDITOR_NEW_TITLE") : title || t("MENU_ARTICLES") })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "small", onClick: handlePreview, disabled: saving, children: t("EDITOR_PREVIEW") }),
        /* @__PURE__ */ jsx(Button, { size: "small", onClick: handleSave, isLoading: saving, children: t("EDITOR_SAVE") })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 lg:col-span-2", children: [
        /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-4", children: [
          /* @__PURE__ */ jsx(Field, { label: t("FIELD_TITLE"), children: /* @__PURE__ */ jsx(
            Input,
            {
              value: title,
              placeholder: t("FIELD_TITLE_PLACEHOLDER"),
              onChange: (e) => setTitle(e.target.value)
            }
          ) }),
          /* @__PURE__ */ jsx(Field, { label: t("FIELD_SLUG"), help: t("FIELD_SLUG_HELP"), children: /* @__PURE__ */ jsx(Input, { value: slug, onChange: (e) => setSlug(e.target.value), placeholder: "auto" }) }),
          /* @__PURE__ */ jsx(Field, { label: t("FIELD_EXCERPT"), children: /* @__PURE__ */ jsx(
            Textarea,
            {
              value: excerpt,
              placeholder: t("FIELD_EXCERPT_PLACEHOLDER"),
              onChange: (e) => setExcerpt(e.target.value)
            }
          ) })
        ] }),
        /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: t("FIELD_CONTENT") }),
          /* @__PURE__ */ jsx(TiptapEditor, { value: content, onChange: setContent })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-4", children: [
          /* @__PURE__ */ jsx(Field, { label: t("FIELD_STATUS"), children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(
              Switch,
              {
                checked: status === "published",
                onCheckedChange: (c) => setStatus(c ? "published" : "draft")
              }
            ),
            /* @__PURE__ */ jsx(Text, { size: "small", children: status === "published" ? t("STATUS_PUBLISHED") : t("STATUS_DRAFT") })
          ] }) }),
          /* @__PURE__ */ jsx(Field, { label: t("FIELD_CATEGORY"), children: /* @__PURE__ */ jsxs(Select, { value: categoryId || "none", onValueChange: (v) => setCategoryId(v === "none" ? "" : v), children: [
            /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, { placeholder: t("NONE") }) }),
            /* @__PURE__ */ jsxs(Select.Content, { children: [
              /* @__PURE__ */ jsx(Select.Item, { value: "none", children: t("NONE") }),
              categories.map((c) => /* @__PURE__ */ jsx(Select.Item, { value: c.id, children: c.name }, c.id))
            ] })
          ] }) }),
          /* @__PURE__ */ jsx(Field, { label: t("FIELD_COVER"), children: /* @__PURE__ */ jsx(
            CoverImage,
            {
              image: coverImage,
              uploading,
              onUpload: handleCover,
              onRemove: () => setCoverImage(null),
              uploadLabel: t("UPLOAD"),
              uploadingLabel: t("UPLOADING"),
              removeLabel: t("REMOVE_IMAGE")
            }
          ) }),
          /* @__PURE__ */ jsx("div", { className: "border-t pt-4", children: /* @__PURE__ */ jsx(
            SalesChannelMultiSelect,
            {
              value: salesChannelIds,
              onChange: setSalesChannelIds,
              label: "Canales de venta",
              help: "Vacío = visible en todos los canales."
            }
          ) })
        ] }),
        /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Heading, { level: "h3", children: t("SECTION_PRODUCTS") }),
            /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: t("PRODUCTS_HELP") })
          ] }),
          /* @__PURE__ */ jsx(ProductSelector, { value: productIds, onChange: setProductIds })
        ] }),
        /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-4", children: [
          /* @__PURE__ */ jsx(Heading, { level: "h3", children: t("SECTION_SEO") }),
          /* @__PURE__ */ jsx(Field, { label: t("FIELD_SEO_TITLE"), children: /* @__PURE__ */ jsx(Input, { value: seoTitle, onChange: (e) => setSeoTitle(e.target.value) }) }),
          /* @__PURE__ */ jsx(Field, { label: t("FIELD_SEO_DESCRIPTION"), children: /* @__PURE__ */ jsx(Textarea, { value: seoDescription, onChange: (e) => setSeoDescription(e.target.value) }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Toaster, {})
  ] });
};
function Field({
  label,
  help,
  children
}) {
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
    /* @__PURE__ */ jsx(Label, { size: "small", weight: "plus", children: label }),
    children,
    help ? /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: help }) : null
  ] });
}
function CoverImage({
  image,
  uploading,
  onUpload,
  onRemove,
  uploadLabel,
  uploadingLabel,
  removeLabel
}) {
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
    (image == null ? void 0 : image.url) ? /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-lg border border-ui-border-base", children: /* @__PURE__ */ jsx("img", { src: image.url, alt: "", className: "h-36 w-full object-cover" }) }) : null,
    /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
      /* @__PURE__ */ jsxs("label", { className: "inline-flex", children: [
        /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "small", asChild: true, children: /* @__PURE__ */ jsx("span", { children: uploading ? uploadingLabel : uploadLabel }) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "file",
            accept: "image/*",
            className: "hidden",
            disabled: uploading,
            onChange: (e) => {
              var _a;
              const f = (_a = e.target.files) == null ? void 0 : _a[0];
              if (f) onUpload(f);
              e.currentTarget.value = "";
            }
          }
        )
      ] }),
      (image == null ? void 0 : image.url) ? /* @__PURE__ */ jsx(Button, { variant: "transparent", size: "small", onClick: onRemove, children: removeLabel }) : null
    ] })
  ] });
}
async function loader({ params }) {
  const id = params.id ?? "";
  if (id === "new") return { breadcrumb: "Nuevo artículo" };
  try {
    const { blog_post } = await sdk.client.fetch(
      `/admin/blog-posts/${id}`,
      { method: "GET" }
    );
    return { breadcrumb: (blog_post == null ? void 0 : blog_post.title) ?? id };
  } catch {
    return { breadcrumb: id };
  }
}
const handle = {
  breadcrumb: ({ data }) => (data == null ? void 0 : data.breadcrumb) ?? ""
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: BlogIndex,
      path: "/blog",
      handle: { label: config$3.label, translationNs: config$3.translationNs, ...handle$1 }
    },
    {
      Component: ArticlesPage,
      path: "/blog/articles",
      handle: { label: config$2.label, translationNs: config$2.translationNs }
    },
    {
      Component: CategoriesPage,
      path: "/blog/categories",
      handle: { label: config$1.label, translationNs: config$1.translationNs }
    },
    {
      Component: SettingsPage,
      path: "/blog/settings",
      handle: { label: config.label, translationNs: config.translationNs }
    },
    {
      Component: ArticleEditor,
      path: "/blog/articles/:id",
      handle,
      loader
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config$3.label,
      icon: config$3.icon,
      path: "/blog",
      nested: void 0,
      rank: 45,
      translationNs: void 0
    },
    {
      label: config$2.label,
      icon: config$2.icon,
      path: "/blog/articles",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config.label,
      icon: config.icon,
      path: "/blog/settings",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config$1.label,
      icon: config$1.icon,
      path: "/blog/categories",
      nested: void 0,
      rank: void 0,
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
