var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DotsSix, Trash, EllipsisHorizontal, PencilSquare, ArrowPath, PlaySolid } from "@medusajs/icons";
import { SiteScopeBar } from "@minimalart/mercatto-plugin-runtime/admin";
import { useTranslation } from "react-i18next";
import { Label, Text, Checkbox, Drawer, Heading, Tabs, StatusBadge, Input, Button, Badge, Textarea, clx, Switch, createDataTableColumnHelper, usePrompt, DropdownMenu, IconButton, useDataTable, Container, DataTable } from "@medusajs/ui";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSensors, useSensor, PointerSensor, DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Navigate } from "react-router-dom";
import "@medusajs/admin-shared";
const VIDEOS_NAMESPACE = "videos";
let registered = false;
const en = {
  // Page
  TITLE: "Videos",
  SUBTITLE: "Manage your Vimeo videos and link them to products.",
  ADD_VIDEO: "Add Video",
  CREATE_BUTTON: "Create",
  // Common actions
  CANCEL: "Cancel",
  REMOVE: "Remove",
  PREVIOUS: "Previous",
  NEXT: "Next",
  YES: "Yes",
  NO: "No",
  LOADING: "Loading...",
  // Videos table
  TABLE_LOADING: "Loading videos...",
  TABLE_EMPTY_TITLE: "No videos found",
  TABLE_EMPTY_SUBTITLE: "Create your first video to get started",
  TABLE_COL_VIDEO: "Video",
  TABLE_COL_STATUS: "Status",
  STATUS_AVAILABLE: "Available",
  STATUS_PROCESSING: "Processing",
  STATUS_TRANSCODING: "Transcoding",
  STATUS_UPLOADING: "Uploading",
  STATUS_ERROR: "Error",
  STATUS_UNKNOWN: "Unknown",
  TABLE_COL_DURATION: "Duration",
  TABLE_COL_ACTIVE: "Active",
  TABLE_COL_SORT_ORDER: "Sort Order",
  TABLE_COL_ACTIONS: "Actions",
  SYNC_FROM_VIMEO: "Sync from Vimeo",
  PAGINATION_SHOWING: "Showing {{from}} to {{to}} of {{count}}",
  DELETE_CONFIRM: "Are you sure you want to delete this video?",
  DELETE_TITLE: "Delete video",
  DELETE_ACTION: "Delete",
  // Create video drawer
  TAB_UPLOAD: "Upload to Vimeo",
  TAB_LINK: "Link Existing Video",
  FILE_DROP_PLACEHOLDER: "Click to select video or drag and drop",
  FILE_FORMATS_HINT: "MP4, MOV, AVI, WebM up to 500MB",
  FILE_READY: "File ready: {{name}}",
  LABEL_TITLE: "Title *",
  PLACEHOLDER_TITLE: "Video title",
  UPLOADING_PROGRESS: "Uploading... {{progress}}%",
  UPLOADING: "Uploading...",
  SEARCH_VIMEO_PLACEHOLDER: "Search your Vimeo videos...",
  GO_TO_VIMEO: "Go to Vimeo",
  LOADING_VIMEO_VIDEOS: "Loading your Vimeo videos...",
  SELECT_A_VIDEO: "Select a Video",
  NO_DESCRIPTION: "No description",
  NO_VIMEO_VIDEOS: "No videos found in your Vimeo account.",
  VIDEO_DETAILS: "Video Details",
  LABEL_DESCRIPTION: "Description",
  PLACEHOLDER_DESCRIPTION: "Video description",
  SELECTED_VIMEO_ID: "Selected Vimeo ID: {{id}}",
  ADD_TO_CATALOG: "Add to Catalog",
  // Create video toasts/alerts
  ERR_SELECT_FILE_TITLE: "Please select a file and enter a title",
  ERR_NO_UPLOAD_LINK: "No upload link received from Vimeo",
  ERR_TUS_NOT_INSTALLED: "tus-js-client is not installed. Run: pnpm add tus-js-client --filter @repo/backend",
  ERR_UPLOAD_FAILED: "Upload failed: {{message}}",
  ERR_UPLOAD_UNKNOWN: "Unknown error",
  ERR_UPLOADED_BUT_NOT_ADDED: "Video uploaded to Vimeo, but failed to add to catalog.\n\nVimeo URI: {{uri}}\n\nPlease add it manually from the Browse section.",
  // Edit video drawer
  EDIT_VIDEO: "Edit Video",
  PREVIEW: "Preview",
  VIMEO_ID_BADGE: "Vimeo ID: {{id}}",
  LINKED_PRODUCTS: "Linked Products",
  UPDATING_PRODUCTS: "Updating products...",
  NO_PRODUCTS_LINKED: "No products linked yet. Add products below.",
  ADD_PRODUCTS: "Add Products",
  SEARCH_PRODUCTS_PLACEHOLDER: "Type to search products...",
  ALREADY_LINKED: "Already linked",
  NO_PRODUCTS_FOUND: 'No products found for "{{query}}"',
  TYPE_AT_LEAST_2_CHARS: "Type at least 2 characters to search",
  SAVE_CHANGES: "Save Changes",
  // Vimeo connection card
  VIMEO_CONNECTION: "Vimeo Connection",
  CONNECTED: "Connected",
  NOT_CONNECTED: "Not Connected",
  CONNECTED_DESCRIPTION: "Your Vimeo account is connected and ready to use.",
  NOT_CONNECTED_DESCRIPTION: "Connect your Vimeo account to upload and manage videos.",
  CONNECTED_AS: "Connected as:",
  DEFAULT_VIMEO_USER: "Vimeo User",
  FOLDER: "Folder:",
  TEST_CONNECTION: "Test Connection",
  CONNECT_ACCOUNT: "Connect Vimeo Account",
  HOW_TO_CONNECT: "How to connect:",
  HOW_TO_STEP_1: 'Click "Connect Vimeo Account" above',
  HOW_TO_STEP_2: "Authorize this app on Vimeo",
  HOW_TO_STEP_3: "You will be redirected back here automatically",
  ENV_TOKEN_HINT: "Alternatively, set VIMEO_ACCESS_TOKEN in the environment to skip OAuth.",
  CONNECTION_ERROR: "Failed to check connection status. Ensure the backend is running and configured correctly."
};
const es = {
  // Page
  TITLE: "Videos",
  SUBTITLE: "Gestiona tus videos de Vimeo y vincúlalos a productos.",
  ADD_VIDEO: "Agregar video",
  CREATE_BUTTON: "Crear",
  // Common actions
  CANCEL: "Cancelar",
  REMOVE: "Quitar",
  PREVIOUS: "Anterior",
  NEXT: "Siguiente",
  YES: "Sí",
  NO: "No",
  LOADING: "Cargando...",
  // Videos table
  TABLE_LOADING: "Cargando videos...",
  TABLE_EMPTY_TITLE: "No se encontraron videos",
  TABLE_EMPTY_SUBTITLE: "Crea tu primer video para empezar",
  TABLE_COL_VIDEO: "Video",
  TABLE_COL_STATUS: "Estado",
  STATUS_AVAILABLE: "Disponible",
  STATUS_PROCESSING: "Procesando",
  STATUS_TRANSCODING: "Transcodificando",
  STATUS_UPLOADING: "Subiendo",
  STATUS_ERROR: "Error",
  STATUS_UNKNOWN: "Desconocido",
  TABLE_COL_DURATION: "Duración",
  TABLE_COL_ACTIVE: "Activo",
  TABLE_COL_SORT_ORDER: "Orden",
  TABLE_COL_ACTIONS: "Acciones",
  SYNC_FROM_VIMEO: "Sincronizar desde Vimeo",
  PAGINATION_SHOWING: "Mostrando {{from}} a {{to}} de {{count}}",
  DELETE_CONFIRM: "¿Estás seguro de que quieres eliminar este video?",
  DELETE_TITLE: "Eliminar video",
  DELETE_ACTION: "Eliminar",
  // Create video drawer
  TAB_UPLOAD: "Subir a Vimeo",
  TAB_LINK: "Vincular video existente",
  FILE_DROP_PLACEHOLDER: "Haz clic para seleccionar un video o arrástralo aquí",
  FILE_FORMATS_HINT: "MP4, MOV, AVI, WebM hasta 500 MB",
  FILE_READY: "Archivo listo: {{name}}",
  LABEL_TITLE: "Título *",
  PLACEHOLDER_TITLE: "Título del video",
  UPLOADING_PROGRESS: "Subiendo... {{progress}}%",
  UPLOADING: "Subiendo...",
  SEARCH_VIMEO_PLACEHOLDER: "Busca tus videos de Vimeo...",
  GO_TO_VIMEO: "Ir a Vimeo",
  LOADING_VIMEO_VIDEOS: "Cargando tus videos de Vimeo...",
  SELECT_A_VIDEO: "Selecciona un video",
  NO_DESCRIPTION: "Sin descripción",
  NO_VIMEO_VIDEOS: "No se encontraron videos en tu cuenta de Vimeo.",
  VIDEO_DETAILS: "Detalles del video",
  LABEL_DESCRIPTION: "Descripción",
  PLACEHOLDER_DESCRIPTION: "Descripción del video",
  SELECTED_VIMEO_ID: "ID de Vimeo seleccionado: {{id}}",
  ADD_TO_CATALOG: "Agregar al catálogo",
  // Create video toasts/alerts
  ERR_SELECT_FILE_TITLE: "Selecciona un archivo e ingresa un título",
  ERR_NO_UPLOAD_LINK: "No se recibió un enlace de subida de Vimeo",
  ERR_TUS_NOT_INSTALLED: "tus-js-client no está instalado. Ejecuta: pnpm add tus-js-client --filter @repo/backend",
  ERR_UPLOAD_FAILED: "Error al subir: {{message}}",
  ERR_UPLOAD_UNKNOWN: "Error desconocido",
  ERR_UPLOADED_BUT_NOT_ADDED: "El video se subió a Vimeo, pero no se pudo agregar al catálogo.\n\nURI de Vimeo: {{uri}}\n\nAgrégalo manualmente desde la sección Explorar.",
  // Edit video drawer
  EDIT_VIDEO: "Editar video",
  PREVIEW: "Vista previa",
  VIMEO_ID_BADGE: "ID de Vimeo: {{id}}",
  LINKED_PRODUCTS: "Productos vinculados",
  UPDATING_PRODUCTS: "Actualizando productos...",
  NO_PRODUCTS_LINKED: "Aún no hay productos vinculados. Agrega productos abajo.",
  ADD_PRODUCTS: "Agregar productos",
  SEARCH_PRODUCTS_PLACEHOLDER: "Escribe para buscar productos...",
  ALREADY_LINKED: "Ya vinculado",
  NO_PRODUCTS_FOUND: 'No se encontraron productos para "{{query}}"',
  TYPE_AT_LEAST_2_CHARS: "Escribe al menos 2 caracteres para buscar",
  SAVE_CHANGES: "Guardar cambios",
  // Vimeo connection card
  VIMEO_CONNECTION: "Conexión con Vimeo",
  CONNECTED: "Conectado",
  NOT_CONNECTED: "No conectado",
  CONNECTED_DESCRIPTION: "Tu cuenta de Vimeo está conectada y lista para usar.",
  NOT_CONNECTED_DESCRIPTION: "Conecta tu cuenta de Vimeo para subir y administrar videos.",
  CONNECTED_AS: "Conectado como:",
  DEFAULT_VIMEO_USER: "Usuario de Vimeo",
  FOLDER: "Carpeta:",
  TEST_CONNECTION: "Probar conexión",
  CONNECT_ACCOUNT: "Conectar cuenta de Vimeo",
  HOW_TO_CONNECT: "Cómo conectar:",
  HOW_TO_STEP_1: 'Haz clic en "Conectar cuenta de Vimeo" arriba',
  HOW_TO_STEP_2: "Autoriza esta app en Vimeo",
  HOW_TO_STEP_3: "Volverás aquí automáticamente",
  ENV_TOKEN_HINT: "Como alternativa, define VIMEO_ACCESS_TOKEN en el entorno para omitir OAuth.",
  CONNECTION_ERROR: "No se pudo verificar el estado de la conexión. Asegúrate de que el backend esté en ejecución y configurado correctamente."
};
const registerVideosTranslations = (i18n) => {
  if (registered || typeof (i18n == null ? void 0 : i18n.addResourceBundle) !== "function") {
    return;
  }
  i18n.addResourceBundle("en", VIDEOS_NAMESPACE, en, true, true);
  i18n.addResourceBundle("es", VIDEOS_NAMESPACE, es, true, true);
  void i18n.loadNamespaces(VIDEOS_NAMESPACE);
  registered = true;
};
class FetchError extends Error {
  constructor(message, status) {
    super(message);
    __publicField(this, "status");
    this.status = status;
    this.name = "FetchError";
  }
}
async function adminFetch(url, opts = {}) {
  const init = {
    method: opts.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...opts.headers ?? {}
    }
  };
  if (opts.body !== void 0) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new FetchError(`${res.status} ${res.statusText}`, res.status);
  }
  return res.json();
}
async function uploadFiles(input) {
  const form = new FormData();
  for (const file of input.files) {
    form.append("files", file);
  }
  const res = await fetch("/admin/uploads", {
    method: "POST",
    credentials: "include",
    body: form
  });
  if (!res.ok) {
    throw new FetchError(`${res.status} ${res.statusText}`, res.status);
  }
  return await res.json();
}
const sdk = {
  client: {
    fetch: adminFetch
  },
  admin: {
    upload: {
      create: uploadFiles
    }
  }
};
const VIDEOS_QUERY_KEY = "videos";
const IN_PROGRESS_VIDEO_STATUSES = [
  "uploading",
  "transcoding",
  "processing",
  "transcode_starting"
];
const useVideos = (params) => {
  const queryParams = new URLSearchParams();
  if (params == null ? void 0 : params.offset) queryParams.set("offset", params.offset.toString());
  if (params == null ? void 0 : params.limit) queryParams.set("limit", params.limit.toString());
  return useQuery({
    queryKey: [VIDEOS_QUERY_KEY, params],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch(`/admin/videos?${queryParams.toString()}`);
        if (response && typeof response === "object" && "videos" in response) {
          return response;
        }
        return await response.json();
      } catch (error) {
        console.error("[Frontend] Videos fetch error:", error);
        throw error;
      }
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      const anyInProgress = ((data == null ? void 0 : data.videos) ?? []).some(
        (v) => IN_PROGRESS_VIDEO_STATUSES.includes(v.status ?? "")
      );
      return anyInProgress ? 5e3 : false;
    }
  });
};
const useVideo = (id) => {
  return useQuery({
    queryKey: [VIDEOS_QUERY_KEY, id],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch(`/admin/videos/${id}`);
        if (response && typeof response === "object" && "video" in response) {
          return response;
        }
        return await response.json();
      } catch (error) {
        console.error("[Frontend] Video fetch error:", error);
        throw error;
      }
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });
};
const useCreateVideo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const response = await fetch("/admin/videos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error(`Failed to create video: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY] });
    }
  });
};
const useUpdateVideo = (id) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/admin/videos/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error(`Failed to update video: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY, id] });
    }
  });
};
const useDeleteVideo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await sdk.client.fetch(`/admin/videos/${id}`, {
        method: "DELETE"
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY] });
    },
    onError: (error) => {
      console.error("[Frontend] Delete failed:", error);
    }
  });
};
const useSyncVideo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await sdk.client.fetch(`/admin/videos/${id}/sync`, {
        method: "POST"
      });
      if (response && typeof response === "object" && "video" in response) {
        return response;
      }
      return await response.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [VIDEOS_QUERY_KEY, id] });
    },
    onError: (error) => {
      console.error("[Frontend] Sync failed:", error);
    }
  });
};
const useLinkProducts = (videoId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productIds) => {
      const response = await fetch(`/admin/videos/${videoId}/products`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: productIds })
      });
      if (!response.ok) {
        throw new Error(`Failed to link products: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await queryClient.refetchQueries({ queryKey: [VIDEOS_QUERY_KEY, videoId] });
      await queryClient.refetchQueries({ queryKey: ["linked-products"] });
    }
  });
};
const useUnlinkProducts = (videoId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productIds) => {
      const response = await fetch(`/admin/videos/${videoId}/products`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: productIds })
      });
      if (!response.ok) {
        throw new Error(`Failed to unlink products: ${response.status} ${response.statusText}`);
      }
      return { success: true };
    },
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await queryClient.refetchQueries({ queryKey: [VIDEOS_QUERY_KEY, videoId] });
      await queryClient.refetchQueries({ queryKey: ["linked-products"] });
    }
  });
};
const useVimeoVideos = (query, page) => {
  const queryParams = new URLSearchParams();
  if (query) queryParams.set("query", query);
  return useQuery({
    queryKey: ["vimeo-videos", query, page],
    queryFn: async () => {
      const response = await sdk.client.fetch(`/admin/vimeo/videos?${queryParams.toString()}`);
      if (response && typeof response === "object" && "data" in response) {
        return response;
      }
      return await response.json();
    }
  });
};
const useVimeoUpload = () => {
  return useMutation({
    mutationFn: async (data) => {
      const response = await fetch("/admin/vimeo/upload", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      return response.json();
    }
  });
};
async function fetchSalesChannels() {
  const params = new URLSearchParams({
    limit: "200",
    fields: "id,name"
  });
  const res = await fetch(`/admin/sales-channels?${params.toString()}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data == null ? void 0 : data.sales_channels) ?? [];
}
const SalesChannelMultiSelect = ({ value, onChange, label, help }) => {
  const { data } = useQuery({
    queryKey: ["plugin-videos", "sales-channels"],
    queryFn: fetchSalesChannels
  });
  const channels = data ?? [];
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
    label && /* @__PURE__ */ jsx(Label, { size: "xsmall", children: label }),
    help && /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: help }),
    /* @__PURE__ */ jsx("div", { className: "flex max-h-56 flex-col gap-2 overflow-y-auto", children: channels.map((c) => /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(
        Checkbox,
        {
          checked: value.includes(c.id),
          onCheckedChange: () => toggle(c.id)
        }
      ),
      /* @__PURE__ */ jsx(Text, { size: "small", children: c.name })
    ] }, c.id)) })
  ] });
};
const CreateVideoDrawer = ({ open, onClose }) => {
  const { t, i18n } = useTranslation("videos");
  registerVideosTranslations(i18n);
  const [activeTab, setActiveTab] = useState("upload");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVimeoId, setSelectedVimeoId] = useState("");
  const [selectedVimeoVideo, setSelectedVimeoVideo] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [salesChannelIds, setSalesChannelIds] = useState([]);
  const { data: vimeoVideos, isLoading: isLoadingVimeo } = useVimeoVideos(searchQuery);
  const createMutation = useCreateVideo();
  const uploadMutation = useVimeoUpload();
  const handleUpload = async () => {
    var _a;
    if (!selectedFile || !title) {
      alert(t("ERR_SELECT_FILE_TITLE"));
      return;
    }
    setIsUploading(true);
    setUploadProgress(5);
    try {
      const uploadData = await uploadMutation.mutateAsync({
        title,
        description,
        file_size: selectedFile.size
      });
      setUploadProgress(10);
      const uploadLink = (_a = uploadData.upload) == null ? void 0 : _a.upload_link;
      const vimeoUri = uploadData.uri;
      if (!uploadLink) {
        throw new Error(t("ERR_NO_UPLOAD_LINK"));
      }
      let tusModule;
      try {
        tusModule = await import("tus-js-client");
      } catch {
        throw new Error(t("ERR_TUS_NOT_INSTALLED"));
      }
      const upload = new tusModule.Upload(selectedFile, {
        uploadUrl: uploadLink,
        endpoint: uploadLink,
        retryDelays: [0, 3e3, 5e3, 1e4, 2e4],
        metadata: {
          filename: selectedFile.name,
          filetype: selectedFile.type
        },
        onError: (error) => {
          console.error("TUS upload failed:", error);
          setIsUploading(false);
          setUploadProgress(0);
          alert(t("ERR_UPLOAD_FAILED", { message: error.message }));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.floor(bytesUploaded / bytesTotal * 90) + 10;
          setUploadProgress(percentage);
        },
        onSuccess: async () => {
          setUploadProgress(100);
          try {
            const vimeoId = vimeoUri.replace("/videos/", "");
            await createMutation.mutateAsync({
              vimeo_id: vimeoId,
              vimeo_uri: vimeoUri,
              title,
              description,
              is_active: true,
              sales_channel_ids: salesChannelIds.length ? salesChannelIds : null
            });
            setSelectedFile(null);
            setTitle("");
            setDescription("");
            setIsUploading(false);
            setUploadProgress(0);
            onClose();
          } catch (error) {
            console.error("Failed to add video to catalog:", error);
            alert(t("ERR_UPLOADED_BUT_NOT_ADDED", { uri: vimeoUri }));
            setIsUploading(false);
            setUploadProgress(0);
          }
        }
      });
      upload.start();
    } catch (error) {
      console.error("Upload initiation failed:", error);
      alert(
        t("ERR_UPLOAD_FAILED", {
          message: error instanceof Error ? error.message : t("ERR_UPLOAD_UNKNOWN")
        })
      );
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  const handleSubmit = async (e) => {
    var _a, _b, _c;
    e.preventDefault();
    if (!selectedVimeoId || !title) {
      return;
    }
    try {
      await createMutation.mutateAsync({
        vimeo_id: selectedVimeoId,
        vimeo_uri: `/videos/${selectedVimeoId}`,
        title,
        description,
        duration: (selectedVimeoVideo == null ? void 0 : selectedVimeoVideo.duration) || null,
        thumbnail_url: ((_c = (_b = (_a = selectedVimeoVideo == null ? void 0 : selectedVimeoVideo.pictures) == null ? void 0 : _a.sizes) == null ? void 0 : _b[0]) == null ? void 0 : _c.link) || null,
        vimeo_url: (selectedVimeoVideo == null ? void 0 : selectedVimeoVideo.link) || null,
        is_active: true,
        sales_channel_ids: salesChannelIds.length ? salesChannelIds : null
      });
      onClose();
      setSelectedVimeoId("");
      setTitle("");
      setDescription("");
      setSearchQuery("");
    } catch (error) {
      console.error("Failed to create video:", error);
    }
  };
  return /* @__PURE__ */ jsx(Drawer, { open, onOpenChange: onClose, children: /* @__PURE__ */ jsxs(Drawer.Content, { className: "flex h-full flex-col", children: [
    /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsx(Heading, { children: t("ADD_VIDEO") }) }),
    /* @__PURE__ */ jsxs(Drawer.Body, { className: "flex flex-1 flex-col gap-6 overflow-y-auto", children: [
      /* @__PURE__ */ jsxs(Tabs, { value: activeTab, onValueChange: setActiveTab, children: [
        /* @__PURE__ */ jsxs(Tabs.List, { children: [
          /* @__PURE__ */ jsx(Tabs.Trigger, { value: "upload", children: t("TAB_UPLOAD") }),
          /* @__PURE__ */ jsx(Tabs.Trigger, { value: "link", children: t("TAB_LINK") })
        ] }),
        /* @__PURE__ */ jsx(Tabs.Content, { value: "upload", className: "flex flex-col gap-3 mt-4", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center p-8 border-2 border-dashed border-ui-border-base rounded-lg bg-ui-bg-subtle", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "file",
                accept: "video/*",
                onChange: (e) => {
                  var _a;
                  const file = (_a = e.target.files) == null ? void 0 : _a[0];
                  if (file) {
                    setSelectedFile(file);
                    if (!title) {
                      setTitle(file.name.replace(/\.[^/.]+$/, ""));
                    }
                  }
                },
                className: "hidden",
                id: "video-file"
              }
            ),
            /* @__PURE__ */ jsxs("label", { htmlFor: "video-file", className: "cursor-pointer text-center w-full", children: [
              /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle mb-2", children: selectedFile ? selectedFile.name : t("FILE_DROP_PLACEHOLDER") }),
              /* @__PURE__ */ jsx(Text, { className: "text-xs text-ui-fg-muted", children: selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : t("FILE_FORMATS_HINT") })
            ] })
          ] }),
          selectedFile && /* @__PURE__ */ jsx(StatusBadge, { color: "green", children: t("FILE_READY", { name: selectedFile.name }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "upload-title", children: t("LABEL_TITLE") }),
            /* @__PURE__ */ jsx(
              Input,
              {
                id: "upload-title",
                type: "text",
                placeholder: t("PLACEHOLDER_TITLE"),
                value: title,
                onChange: (e) => setTitle(e.target.value)
              }
            )
          ] }),
          isUploading && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsx(Text, { className: "text-sm", children: t("UPLOADING_PROGRESS", { progress: uploadProgress }) }),
            /* @__PURE__ */ jsx("div", { className: "w-full bg-ui-bg-subtle rounded-full h-2", children: /* @__PURE__ */ jsx(
              "div",
              {
                className: "bg-ui-fg-interactive h-2 rounded-full transition-all",
                style: { width: `${uploadProgress}%` }
              }
            ) })
          ] }),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "primary",
              onClick: handleUpload,
              disabled: !selectedFile || !title || isUploading,
              isLoading: isUploading,
              children: isUploading ? t("UPLOADING") : t("TAB_UPLOAD")
            }
          )
        ] }) }),
        /* @__PURE__ */ jsx(Tabs.Content, { value: "link", className: "flex flex-col gap-3 mt-4", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx(
              Input,
              {
                type: "text",
                placeholder: t("SEARCH_VIMEO_PLACEHOLDER"),
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
                className: "flex-1"
              }
            ),
            /* @__PURE__ */ jsx(
              Button,
              {
                variant: "secondary",
                onClick: () => window.open("https://vimeo.com/upload", "_blank"),
                children: t("GO_TO_VIMEO")
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 max-h-[300px] overflow-y-auto border border-ui-border-base rounded-lg p-2", children: [
            isLoadingVimeo && /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle p-4", children: t("LOADING_VIMEO_VIDEOS") }),
            vimeoVideos && vimeoVideos.data && vimeoVideos.data.length > 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
              /* @__PURE__ */ jsx(Label, { children: t("SELECT_A_VIDEO") }),
              /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-2", children: vimeoVideos.data.map((video) => {
                var _a, _b, _c;
                return /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      const vimeoId = video.uri.split("/").pop() || "";
                      setSelectedVimeoId(vimeoId);
                      setSelectedVimeoVideo(video);
                      setTitle(video.name || "");
                      setDescription(video.description || "");
                    },
                    className: `w-full p-3 text-left hover:bg-ui-bg-subtle transition-colors border-b border-ui-border-base last:border-b-0 ${selectedVimeoId === video.uri.split("/").pop() ? "bg-ui-bg-subtle" : ""}`,
                    children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                      ((_c = (_b = (_a = video.pictures) == null ? void 0 : _a.sizes) == null ? void 0 : _b[0]) == null ? void 0 : _c.link) && /* @__PURE__ */ jsx(
                        "img",
                        {
                          src: video.pictures.sizes[0].link,
                          alt: video.name,
                          className: "w-20 h-12 object-cover rounded"
                        }
                      ),
                      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                        /* @__PURE__ */ jsx(Text, { className: "font-medium truncate", children: video.name }),
                        /* @__PURE__ */ jsx(Text, { className: "text-xs text-ui-fg-subtle truncate", children: video.description || t("NO_DESCRIPTION") }),
                        /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2 mt-1", children: /* @__PURE__ */ jsxs(Badge, { size: "small", children: [
                          video.duration,
                          "s"
                        ] }) })
                      ] })
                    ] })
                  },
                  video.uri
                );
              }) })
            ] }),
            vimeoVideos && vimeoVideos.data && vimeoVideos.data.length === 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-col items-center justify-center p-8", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle mb-4 text-center", children: t("NO_VIMEO_VIDEOS") }) })
          ] }),
          selectedVimeoId && /* @__PURE__ */ jsxs("div", { className: "border-t pt-3 mt-3", children: [
            /* @__PURE__ */ jsx(Heading, { level: "h3", className: "mb-4", children: t("VIDEO_DETAILS") }),
            /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx(Label, { htmlFor: "title", children: t("LABEL_TITLE") }),
                /* @__PURE__ */ jsx(
                  Input,
                  {
                    id: "title",
                    type: "text",
                    placeholder: t("PLACEHOLDER_TITLE"),
                    value: title,
                    onChange: (e) => setTitle(e.target.value),
                    required: true
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx(Label, { htmlFor: "description", children: t("LABEL_DESCRIPTION") }),
                /* @__PURE__ */ jsx(
                  Textarea,
                  {
                    id: "description",
                    placeholder: t("PLACEHOLDER_DESCRIPTION"),
                    value: description,
                    onChange: (e) => setDescription(e.target.value),
                    rows: 3
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(StatusBadge, { color: "green", children: t("SELECTED_VIMEO_ID", { id: selectedVimeoId }) })
            ] })
          ] })
        ] }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "border-t pt-4", children: /* @__PURE__ */ jsx(
        SalesChannelMultiSelect,
        {
          value: salesChannelIds,
          onChange: setSalesChannelIds,
          label: t("LABEL_SALES_CHANNELS", { defaultValue: "Canales de venta" }),
          help: t("SALES_CHANNELS_HELP", {
            defaultValue: "Vacío = visible en todos los canales. Elegí canales para mostrar el video solo en esas demos."
          })
        }
      ) })
    ] }),
    /* @__PURE__ */ jsx(Drawer.Footer, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 justify-end w-full", children: [
      /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClose, children: t("CANCEL") }),
      activeTab === "link" && /* @__PURE__ */ jsx(
        Button,
        {
          variant: "primary",
          onClick: handleSubmit,
          disabled: !selectedVimeoId || !title || createMutation.isPending,
          isLoading: createMutation.isPending,
          children: t("ADD_TO_CATALOG")
        }
      )
    ] }) })
  ] }) });
};
async function listProducts(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, v);
    } else {
      search.set(key, String(value));
    }
  }
  const res = await fetch(`/admin/products?${search.toString()}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data == null ? void 0 : data.products) ?? [];
}
const ProductSelector = ({ value, onChange }) => {
  const { t } = useTranslation("videos");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const { data: searchData } = useQuery({
    queryKey: ["plugin-videos", "product-search", debounced],
    queryFn: () => listProducts({
      q: debounced,
      limit: 8,
      fields: "id,title,thumbnail"
    }),
    enabled: debounced.length > 0
  });
  const { data: selectedData } = useQuery({
    queryKey: ["plugin-videos", "product-selected", value],
    queryFn: () => listProducts({
      id: value,
      limit: value.length,
      fields: "id,title,thumbnail"
    }),
    enabled: value.length > 0
  });
  const selectedProducts = useMemo(() => {
    const byId = new Map(
      (selectedData ?? []).map((p) => [
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
  const results = (searchData ?? []).filter((p) => !value.includes(p.id));
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx(
        Input,
        {
          placeholder: t("PRODUCTS_SEARCH", { defaultValue: "Search products…" }),
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
    value.length === 0 ? /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-muted", children: t("PRODUCTS_EMPTY", { defaultValue: "No products linked yet." }) }) : /* @__PURE__ */ jsx(
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
            removeLabel: t("PRODUCTS_REMOVE", { defaultValue: "Remove" })
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
const EditVideoDrawer = ({ videoId, open, onClose }) => {
  const { t, i18n } = useTranslation("videos");
  registerVideosTranslations(i18n);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [showInCarousel, setShowInCarousel] = useState(true);
  const [posterUrl, setPosterUrl] = useState("");
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [salesChannelIds, setSalesChannelIds] = useState([]);
  const [productIds, setProductIds] = useState([]);
  const originalProductIdsRef = useRef([]);
  const posterInputRef = useRef(null);
  const { data: videoData, isLoading } = useVideo(videoId || "");
  const updateMutation = useUpdateVideo(videoId || "");
  const linkProductsMutation = useLinkProducts(videoId || "");
  const unlinkProductsMutation = useUnlinkProducts(videoId || "");
  const video = videoData == null ? void 0 : videoData.video;
  useEffect(() => {
    if (video) {
      setTitle(video.title || "");
      setDescription(video.description || "");
      setIsActive(video.is_active ?? true);
      setShowInCarousel(video.show_in_carousel ?? true);
      setPosterUrl(video.poster_url || "");
      setSortOrder(video.sort_order || 0);
      setSalesChannelIds(video.sales_channel_ids ?? []);
      const links = (video.product_links ?? []).map(
        (l) => l.product_id
      );
      setProductIds(links);
      originalProductIdsRef.current = links;
    }
  }, [video]);
  const handlePosterFile = async (e) => {
    var _a, _b;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    e.target.value = "";
    if (!file) return;
    setIsUploadingPoster(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const uploaded = (_b = res.files) == null ? void 0 : _b[0];
      if (uploaded == null ? void 0 : uploaded.url) setPosterUrl(uploaded.url);
    } catch (error) {
      console.error("[EditVideoDrawer] Poster upload failed:", error);
    } finally {
      setIsUploadingPoster(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoId) return;
    try {
      await updateMutation.mutateAsync({
        title,
        description,
        is_active: isActive,
        show_in_carousel: showInCarousel,
        poster_url: posterUrl || null,
        sort_order: sortOrder,
        sales_channel_ids: salesChannelIds.length ? salesChannelIds : null
      });
      const original = originalProductIdsRef.current;
      const added = productIds.filter((id) => !original.includes(id));
      const removed = original.filter((id) => !productIds.includes(id));
      if (added.length) await linkProductsMutation.mutateAsync(added);
      if (removed.length) await unlinkProductsMutation.mutateAsync(removed);
      originalProductIdsRef.current = productIds;
      onClose();
    } catch (error) {
      console.error("[EditVideoDrawer] Failed to update video:", error);
    }
  };
  if (isLoading) {
    return /* @__PURE__ */ jsx(Drawer, { open, onOpenChange: onClose, children: /* @__PURE__ */ jsx(Drawer.Content, { children: /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsx(Heading, { children: t("LOADING") }) }) }) });
  }
  return /* @__PURE__ */ jsx(Drawer, { open, onOpenChange: onClose, children: /* @__PURE__ */ jsxs(Drawer.Content, { className: "flex h-full flex-col", children: [
    /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsx(Heading, { children: t("EDIT_VIDEO") }) }),
    /* @__PURE__ */ jsxs(Drawer.Body, { className: "flex flex-1 flex-col gap-6 overflow-y-auto", children: [
      (video == null ? void 0 : video.thumbnail_url) && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsx(Label, { children: t("PREVIEW") }),
        /* @__PURE__ */ jsx(
          "img",
          {
            src: video.thumbnail_url,
            alt: video.title,
            className: "w-full h-48 object-cover rounded-lg"
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(Badge, { size: "small", children: t("VIMEO_ID_BADGE", { id: video.vimeo_id }) }),
          /* @__PURE__ */ jsx(StatusBadge, { color: video.status === "available" ? "green" : "blue", children: t(`STATUS_${(video.status || "unknown").toUpperCase()}`, { defaultValue: video.status }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "title", children: t("LABEL_TITLE") }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "title",
              type: "text",
              placeholder: t("PLACEHOLDER_TITLE"),
              value: title,
              onChange: (e) => setTitle(e.target.value),
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "description", children: t("LABEL_DESCRIPTION") }),
          /* @__PURE__ */ jsx(
            Textarea,
            {
              id: "description",
              placeholder: t("PLACEHOLDER_DESCRIPTION"),
              value: description,
              onChange: (e) => setDescription(e.target.value),
              rows: 3
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "is_active", children: t("TABLE_COL_ACTIVE") }),
          /* @__PURE__ */ jsx(Switch, { id: "is_active", checked: isActive, onCheckedChange: setIsActive })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "show_in_carousel", children: t("LABEL_SHOW_IN_CAROUSEL", { defaultValue: "Mostrar en el carrousel de la home" }) }),
            /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: t("SHOW_IN_CAROUSEL_HELP", {
              defaultValue: "Si está apagado, el video sigue activo pero no aparece en el carrousel."
            }) })
          ] }),
          /* @__PURE__ */ jsx(
            Switch,
            {
              id: "show_in_carousel",
              checked: showInCarousel,
              onCheckedChange: setShowInCarousel
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsx(Label, { children: t("LABEL_POSTER", { defaultValue: "Miniatura (poster)" }) }),
          /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: t("POSTER_HELP", {
            defaultValue: "Se muestra en el front mientras el video carga. Si no elegís una, se usa la de Vimeo."
          }) }),
          (posterUrl || (video == null ? void 0 : video.thumbnail_url)) && /* @__PURE__ */ jsx(
            "img",
            {
              src: posterUrl || (video == null ? void 0 : video.thumbnail_url),
              alt: t("LABEL_POSTER", { defaultValue: "Miniatura (poster)" }),
              className: "h-48 w-full rounded-lg object-cover"
            }
          ),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref: posterInputRef,
              type: "file",
              accept: "image/*",
              className: "hidden",
              onChange: handlePosterFile
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(
              Button,
              {
                type: "button",
                size: "small",
                variant: "secondary",
                onClick: () => {
                  var _a;
                  return (_a = posterInputRef.current) == null ? void 0 : _a.click();
                },
                isLoading: isUploadingPoster,
                children: t("UPLOAD_POSTER", { defaultValue: "Subir imagen" })
              }
            ),
            posterUrl && /* @__PURE__ */ jsx(
              Button,
              {
                type: "button",
                size: "small",
                variant: "transparent",
                onClick: () => setPosterUrl(""),
                children: t("CLEAR_POSTER", { defaultValue: "Quitar" })
              }
            )
          ] }),
          /* @__PURE__ */ jsx(
            Input,
            {
              type: "text",
              placeholder: t("POSTER_URL_PLACEHOLDER", { defaultValue: "o pegá una URL de imagen" }),
              value: posterUrl,
              onChange: (e) => setPosterUrl(e.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "sort_order", children: t("TABLE_COL_SORT_ORDER") }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "sort_order",
              type: "number",
              value: sortOrder,
              onChange: (e) => setSortOrder(parseInt(e.target.value) || 0)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "border-t pt-4", children: /* @__PURE__ */ jsx(
          SalesChannelMultiSelect,
          {
            value: salesChannelIds,
            onChange: setSalesChannelIds,
            label: "Canales de venta",
            help: "Vacío = visible en todos los canales. Elegí canales para mostrar el video solo en esas demos."
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 border-t pt-4", children: [
        /* @__PURE__ */ jsx(Heading, { level: "h3", children: t("LINKED_PRODUCTS") }),
        /* @__PURE__ */ jsx(ProductSelector, { value: productIds, onChange: setProductIds })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Drawer.Footer, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 justify-end w-full", children: [
      /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClose, children: t("CANCEL") }),
      /* @__PURE__ */ jsx(
        Button,
        {
          variant: "primary",
          onClick: handleSubmit,
          disabled: !title || updateMutation.isPending,
          isLoading: updateMutation.isPending,
          children: t("SAVE_CHANGES")
        }
      )
    ] }) })
  ] }) });
};
const PLUGIN_VERSION = "1.2.0";
const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper();
const getStatusColor = (status) => {
  switch (status) {
    case "available":
      return "green";
    case "processing":
    case "transcoding":
      return "blue";
    case "uploading":
      return "orange";
    case "error":
      return "red";
    default:
      return "grey";
  }
};
const formatDuration = (seconds) => {
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};
const VideosTable = () => {
  const { t, i18n } = useTranslation("videos");
  registerVideosTranslations(i18n);
  const prompt = usePrompt();
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const [editVideoId, setEditVideoId] = useState(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isLoading, refetch } = useVideos({ offset, limit: pagination.pageSize });
  const deleteMutation = useDeleteVideo();
  const syncMutation = useSyncVideo();
  const videos = (data == null ? void 0 : data.videos) || [];
  const count = (data == null ? void 0 : data.count) || 0;
  const handleDelete = async (id) => {
    const confirmed = await prompt({
      title: t("DELETE_TITLE"),
      description: t("DELETE_CONFIRM"),
      variant: "danger",
      confirmText: t("DELETE_ACTION"),
      cancelText: t("CANCEL")
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      await refetch();
    } catch (error) {
      console.error("[VideosTable] Delete failed:", error);
    }
  };
  const handleSync = async (id) => {
    try {
      await syncMutation.mutateAsync(id);
      await refetch();
    } catch (error) {
      console.error("[VideosTable] Sync failed:", error);
    }
  };
  const columns = useMemo(
    () => [
      columnHelper.accessor("title", {
        header: t("TABLE_COL_VIDEO"),
        cell: ({ row }) => {
          const video = row.original;
          return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
            video.thumbnail_url ? /* @__PURE__ */ jsx(
              "img",
              {
                src: video.thumbnail_url,
                alt: video.title,
                className: "w-16 h-10 object-cover rounded"
              }
            ) : /* @__PURE__ */ jsx("div", { className: "w-16 h-10 bg-ui-bg-subtle rounded flex items-center justify-center", children: /* @__PURE__ */ jsx(
              "svg",
              {
                className: "w-6 h-6 text-ui-fg-muted",
                fill: "none",
                viewBox: "0 0 24 24",
                stroke: "currentColor",
                children: /* @__PURE__ */ jsx(
                  "path",
                  {
                    strokeLinecap: "round",
                    strokeLinejoin: "round",
                    strokeWidth: 2,
                    d: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  }
                )
              }
            ) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { className: "font-medium", children: video.title }),
              video.description ? /* @__PURE__ */ jsx(Text, { className: "text-xs text-ui-fg-subtle line-clamp-1", children: video.description }) : null
            ] })
          ] });
        }
      }),
      columnHelper.accessor("status", {
        header: t("TABLE_COL_STATUS"),
        cell: ({ getValue }) => {
          const status = getValue();
          return /* @__PURE__ */ jsx(StatusBadge, { color: getStatusColor(status), children: t(`STATUS_${(status || "unknown").toUpperCase()}`, { defaultValue: status }) });
        }
      }),
      columnHelper.accessor("duration", {
        header: t("TABLE_COL_DURATION"),
        cell: ({ getValue }) => /* @__PURE__ */ jsx(Text, { className: "text-sm", children: formatDuration(getValue()) })
      }),
      columnHelper.accessor("is_active", {
        header: t("TABLE_COL_ACTIVE"),
        cell: ({ getValue }) => /* @__PURE__ */ jsx(StatusBadge, { color: getValue() ? "green" : "grey", children: getValue() ? t("YES") : t("NO") })
      }),
      columnHelper.accessor("sort_order", {
        header: t("TABLE_COL_SORT_ORDER"),
        cell: ({ getValue }) => /* @__PURE__ */ jsx(Text, { className: "text-sm", children: getValue() })
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const video = row.original;
          return /* @__PURE__ */ jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
            /* @__PURE__ */ jsx(DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsx(IconButton, { size: "small", variant: "transparent", children: /* @__PURE__ */ jsx(EllipsisHorizontal, {}) }) }),
            /* @__PURE__ */ jsxs(DropdownMenu.Content, { align: "end", children: [
              /* @__PURE__ */ jsxs(
                DropdownMenu.Item,
                {
                  className: "gap-x-2",
                  onClick: () => setEditVideoId(video.id),
                  children: [
                    /* @__PURE__ */ jsx(PencilSquare, { className: "text-ui-fg-subtle" }),
                    t("EDIT_VIDEO")
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                DropdownMenu.Item,
                {
                  className: "gap-x-2",
                  onClick: () => handleSync(video.id),
                  disabled: syncMutation.isPending,
                  children: [
                    /* @__PURE__ */ jsx(ArrowPath, { className: "text-ui-fg-subtle" }),
                    t("SYNC_FROM_VIMEO")
                  ]
                }
              ),
              /* @__PURE__ */ jsx(DropdownMenu.Separator, {}),
              /* @__PURE__ */ jsxs(
                DropdownMenu.Item,
                {
                  className: "gap-x-2",
                  onClick: () => handleDelete(video.id),
                  disabled: deleteMutation.isPending,
                  children: [
                    /* @__PURE__ */ jsx(Trash, { className: "text-ui-fg-subtle" }),
                    t("DELETE_ACTION")
                  ]
                }
              )
            ] })
          ] }) });
        }
      })
    ],
    [t, deleteMutation.isPending, syncMutation.isPending]
  );
  const table = useDataTable({
    columns,
    data: videos,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination
    },
    onRowClick: (_event, row) => setEditVideoId(row.id)
  });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Container, { className: "p-0", children: /* @__PURE__ */ jsxs(DataTable, { instance: table, children: [
      /* @__PURE__ */ jsxs(DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-2", children: [
          /* @__PURE__ */ jsx(Heading, { children: t("TITLE") }),
          /* @__PURE__ */ jsxs(Badge, { size: "2xsmall", children: [
            "v",
            PLUGIN_VERSION
          ] })
        ] }),
        /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "small", onClick: () => setIsCreateDrawerOpen(true), children: t("CREATE_BUTTON") })
      ] }),
      count > 0 || isLoading ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(DataTable.Table, {}),
        /* @__PURE__ */ jsx(DataTable.Pagination, {})
      ] }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-1 border-t py-12", children: [
        /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: t("TABLE_EMPTY_TITLE") }),
        /* @__PURE__ */ jsx(Text, { className: "text-sm text-ui-fg-muted", children: t("TABLE_EMPTY_SUBTITLE") })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(CreateVideoDrawer, { open: isCreateDrawerOpen, onClose: () => setIsCreateDrawerOpen(false) }),
    /* @__PURE__ */ jsx(
      EditVideoDrawer,
      {
        videoId: editVideoId,
        open: !!editVideoId,
        onClose: () => setEditVideoId(null)
      }
    )
  ] });
};
const VideosPage = () => {
  const { i18n } = useTranslation("videos");
  registerVideosTranslations(i18n);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-4", children: [
    /* @__PURE__ */ jsx(SiteScopeBar, { screen: "videos", variant: "card" }),
    /* @__PURE__ */ jsx(VideosTable, {})
  ] });
};
const VideosIcon = () => /* @__PURE__ */ jsx(PlaySolid, { style: { color: "#FF4F51" } });
const config$1 = defineRouteConfig({
  label: "Videos",
  icon: VideosIcon,
  rank: 20
});
const handle$1 = {
  breadcrumb: () => "Videos"
};
const CredentialsPage = () => /* @__PURE__ */ jsx(Navigate, { to: "/settings/site-credentials#videos", replace: true });
const config = defineRouteConfig({ label: "Credenciales", rank: 99 });
const handle = { breadcrumb: () => "Credenciales" };
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: VideosPage,
      path: "/videos",
      handle: { label: config$1.label, translationNs: config$1.translationNs, ...handle$1 }
    },
    {
      Component: CredentialsPage,
      path: "/videos/credenciales",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config$1.label,
      icon: config$1.icon,
      path: "/videos",
      nested: void 0,
      rank: 20,
      translationNs: void 0
    },
    {
      label: config.label,
      icon: void 0,
      path: "/videos/credenciales",
      nested: void 0,
      rank: 99,
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
