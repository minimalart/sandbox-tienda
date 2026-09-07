"use strict";
const jsxRuntime = require("react/jsx-runtime");
const adminSdk = require("@medusajs/admin-sdk");
const icons = require("@medusajs/icons");
const ui = require("@medusajs/ui");
const react = require("react");
const reactI18next = require("react-i18next");
const reactQuery = require("@tanstack/react-query");
const Medusa = require("@medusajs/js-sdk");
const admin = require("@minimalart/mercatto-plugin-runtime/admin");
const reactRouterDom = require("react-router-dom");
require("@medusajs/admin-shared");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const Medusa__default = /* @__PURE__ */ _interopDefault(Medusa);
const sdk = new Medusa__default.default({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const queryKeysFactory = (globalKey) => {
  const queryKeyFactory = {
    all: [globalKey],
    lists: () => [...queryKeyFactory.all, "list"],
    list: (query) => [...queryKeyFactory.lists(), { query }],
    details: () => [...queryKeyFactory.all, "detail"],
    detail: (id, query) => [
      ...queryKeyFactory.details(),
      id,
      { query }
    ]
  };
  return queryKeyFactory;
};
function toQueryString(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null || value === "") continue;
    params.append(key, String(value));
  }
  return params.toString();
}
const brandQueryKey = queryKeysFactory("brand");
const useBrands = (query, options) => {
  const filterQuery = toQueryString(query);
  const fetchBrands = async () => sdk.client.fetch(`/admin/brands${filterQuery ? `?${filterQuery}` : ""}`, {
    method: "GET"
  });
  return reactQuery.useQuery({
    queryKey: brandQueryKey.list(query),
    queryFn: fetchBrands,
    ...options
  });
};
const useBrand = (brandId, query, options) => {
  const filterQuery = toQueryString(query);
  const fetchBrand = async () => sdk.client.fetch(
    `/admin/brands/${brandId}${filterQuery ? `?${filterQuery}` : ""}`,
    {
      method: "GET"
    }
  );
  return reactQuery.useQuery({
    queryKey: brandQueryKey.detail(brandId),
    queryFn: fetchBrand,
    enabled: !!brandId,
    ...options
  });
};
const useCreateBrand = (options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (brand) => sdk.client.fetch("/admin/brands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: brand
    }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.lists()
      });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const useUpdateBrand = (brandId, options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (brand) => sdk.client.fetch(`/admin/brands/${brandId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: brand
    }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.lists()
      });
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.detail(brandId)
      });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const useDeleteBrand = (brandId, options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: () => sdk.client.fetch(`/admin/brands/${brandId}`, {
      method: "DELETE"
    }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.lists()
      });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const useBrandImages = (brandId, options) => {
  const fetchImages = async () => sdk.client.fetch(`/admin/brands/${brandId}/images`, {
    method: "GET"
  });
  return reactQuery.useQuery({
    queryKey: [...brandQueryKey.detail(brandId), "images"],
    queryFn: fetchImages,
    enabled: !!brandId,
    ...options
  });
};
const useCreateBrandImages = (brandId, options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (data) => sdk.client.fetch(`/admin/brands/${brandId}/images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: data
    }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.detail(brandId)
      });
      queryClient.invalidateQueries({
        queryKey: [...brandQueryKey.detail(brandId), "images"]
      });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const useDeleteBrandImage = (brandId, options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (imageId) => sdk.client.fetch(
      `/admin/brands/${brandId}/images/${imageId}`,
      {
        method: "DELETE"
      }
    ),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({
        queryKey: brandQueryKey.detail(brandId)
      });
      queryClient.invalidateQueries({
        queryKey: [...brandQueryKey.detail(brandId), "images"]
      });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const BRANDS_NAMESPACE = "brands";
let registered = false;
const en = {
  // List page
  TITLE: "Brands",
  COLUMN_NAME: "Name",
  COLUMN_HANDLE: "Handle",
  COLUMN_DESCRIPTION: "Description",
  COLUMN_STATUS: "Status",
  COLUMN_ACTIONS: "Actions",
  STATUS_ACTIVE: "Active",
  STATUS_INACTIVE: "Inactive",
  EMPTY_STATE: "No brands found. Create your first brand to get started.",
  CREATE_BUTTON: "Create",
  SEARCH_PLACEHOLDER: "Search brands",
  // Form fields (shared by create & edit)
  FIELD_NAME_LABEL: "Name *",
  FIELD_NAME_PLACEHOLDER: "Brand name",
  FIELD_HANDLE_LABEL: "Handle *",
  FIELD_HANDLE_PLACEHOLDER: "brand-handle",
  FIELD_HANDLE_HELP: "URL-friendly identifier for the brand",
  FIELD_DESCRIPTION_LABEL: "Description",
  FIELD_DESCRIPTION_PLACEHOLDER: "Brand description",
  FIELD_ACTIVE_LABEL: "Active",
  FIELD_ACTIVE_HELP: "Inactive brands won't be visible in the store",
  // Create drawer
  CREATE_TITLE: "Create Brand",
  CREATE_SUBMIT: "Create Brand",
  CREATE_SUCCESS: "Brand created successfully",
  CREATE_ERROR: "Failed to create brand: {{msg}}",
  VALIDATION_REQUIRED: "Name and handle are required",
  // Edit drawer
  EDIT_TITLE: "Edit Brand",
  EDIT_SUBMIT: "Save Changes",
  UPDATE_SUCCESS: "Brand updated successfully",
  UPDATE_ERROR: "Failed to update brand: {{msg}}",
  // Common buttons
  CANCEL: "Cancel",
  // Actions menu
  ACTION_EDIT: "Edit",
  ACTION_DELETE: "Delete",
  DELETE_PROMPT_TITLE: "Delete Brand",
  DELETE_PROMPT_DESCRIPTION: 'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
  DELETE_PROMPT_CONFIRM: "Delete",
  DELETE_PROMPT_CANCEL: "Cancel",
  DELETE_SUCCESS: "Brand deleted successfully",
  DELETE_ERROR: "Failed to delete brand: {{msg}}",
  // Export
  EXPORT_BUTTON: "Export CSV",
  EXPORT_LOADING: "Exporting...",
  EXPORT_SUCCESS: "Brands exported successfully",
  EXPORT_ERROR: "Failed to export brands: {{msg}}",
  // CSV bulk wizard
  BULK_TRIGGER: "Bulk Upload CSV",
  BULK_TITLE: "Bulk Link Products to Brands",
  BULK_STEP1_TITLE: "How it works",
  BULK_STEP1_LINE1: "Download the CSV template below",
  BULK_STEP1_LINE2: "Fill in the product handle (or variant SKU) and brand handle",
  BULK_STEP1_LINE3: "Upload the completed CSV file",
  BULK_SMART_UPDATE_LABEL: "Smart Update:",
  BULK_SMART_UPDATE_TEXT: "Existing brand links will be replaced with the new brand from the CSV",
  BULK_STEP2_TITLE: "Download Template",
  BULK_DOWNLOAD_TEMPLATE: "Download CSV Template",
  BULK_STEP3_TITLE: "Upload Your CSV",
  BULK_UPLOAD_CLICK: "Click to select CSV file",
  BULK_UPLOAD_DRAG: "or drag and drop your file here",
  BULK_REMOVE_FILE: "Remove file",
  BULK_RESULTS_TITLE: "Processing Results",
  BULK_RESULTS_SUCCESS: "Success",
  BULK_RESULTS_FAILED: "Failed",
  BULK_ERROR_DETAILS: "Error Details:",
  BULK_ROW: "Row {{row}}:",
  BULK_SUBMIT: "Process CSV",
  BULK_SUBMIT_LOADING: "Processing...",
  BULK_TEMPLATE_DOWNLOADED: "Template downloaded successfully",
  BULK_INVALID_FILE: "Please select a CSV file",
  BULK_NO_FILE: "Please select a file",
  BULK_NO_ROWS: "No valid data rows found in CSV",
  BULK_LINK_SUCCESS: "Successfully linked {{count}} products to brands",
  BULK_PROCESS_WITH_ERRORS: "Processed with errors: {{success}} succeeded, {{failed}} failed",
  BULK_PROCESS_ERROR: "Failed to process CSV: {{msg}}",
  // Image section
  IMAGES_TITLE: "Brand Images",
  IMAGE_THUMBNAIL_LABEL: "Thumbnail",
  IMAGE_THUMBNAIL_HELP: "Main brand image displayed in listings",
  IMAGE_ADDITIONAL_LABEL: "Additional Images",
  IMAGE_ADDITIONAL_HELP: "Gallery images for the brand page",
  IMAGE_ADD_THUMBNAIL: "Add thumbnail",
  IMAGE_ADD: "Add",
  IMAGE_UPLOADING: "Uploading...",
  IMAGE_LOADING: "Loading images...",
  IMAGE_UPLOAD_SUCCESS: "Image uploaded successfully",
  IMAGE_UPLOAD_ERROR: "Failed to upload image: {{msg}}",
  IMAGE_DELETE_SUCCESS: "Image deleted successfully",
  IMAGE_DELETE_ERROR: "Failed to delete image: {{msg}}",
  IMAGE_UPLOAD_FAILED: "Upload failed: {{msg}}",
  IMAGE_OR_URL: "Or paste an image URL (recommended — persists across deploys)",
  IMAGE_URL_PLACEHOLDER: "https://…/logo.png",
  IMAGE_URL_BUTTON: "Use URL",
  IMAGE_URL_INVALID: "Enter a valid image URL (http/https)",
  IMAGE_URL_SUCCESS: "Image set from URL"
};
const es = {
  // List page
  TITLE: "Marcas",
  COLUMN_NAME: "Nombre",
  COLUMN_HANDLE: "Identificador",
  COLUMN_DESCRIPTION: "Descripción",
  COLUMN_STATUS: "Estado",
  COLUMN_ACTIONS: "Acciones",
  STATUS_ACTIVE: "Activa",
  STATUS_INACTIVE: "Inactiva",
  EMPTY_STATE: "No se encontraron marcas. Creá tu primera marca para empezar.",
  CREATE_BUTTON: "Crear",
  SEARCH_PLACEHOLDER: "Buscar marcas",
  // Form fields (shared by create & edit)
  FIELD_NAME_LABEL: "Nombre *",
  FIELD_NAME_PLACEHOLDER: "Nombre de la marca",
  FIELD_HANDLE_LABEL: "Identificador *",
  FIELD_HANDLE_PLACEHOLDER: "identificador-marca",
  FIELD_HANDLE_HELP: "Identificador amigable para la URL de la marca",
  FIELD_DESCRIPTION_LABEL: "Descripción",
  FIELD_DESCRIPTION_PLACEHOLDER: "Descripción de la marca",
  FIELD_ACTIVE_LABEL: "Activa",
  FIELD_ACTIVE_HELP: "Las marcas inactivas no se mostrarán en la tienda",
  // Create drawer
  CREATE_TITLE: "Crear marca",
  CREATE_SUBMIT: "Crear marca",
  CREATE_SUCCESS: "Marca creada correctamente",
  CREATE_ERROR: "Error al crear la marca: {{msg}}",
  VALIDATION_REQUIRED: "El nombre y el identificador son obligatorios",
  // Edit drawer
  EDIT_TITLE: "Editar marca",
  EDIT_SUBMIT: "Guardar cambios",
  UPDATE_SUCCESS: "Marca actualizada correctamente",
  UPDATE_ERROR: "Error al actualizar la marca: {{msg}}",
  // Common buttons
  CANCEL: "Cancelar",
  // Actions menu
  ACTION_EDIT: "Editar",
  ACTION_DELETE: "Eliminar",
  DELETE_PROMPT_TITLE: "Eliminar marca",
  DELETE_PROMPT_DESCRIPTION: '¿Estás seguro de que querés eliminar "{{name}}"? Esta acción no se puede deshacer.',
  DELETE_PROMPT_CONFIRM: "Eliminar",
  DELETE_PROMPT_CANCEL: "Cancelar",
  DELETE_SUCCESS: "Marca eliminada correctamente",
  DELETE_ERROR: "Error al eliminar la marca: {{msg}}",
  // Export
  EXPORT_BUTTON: "Exportar CSV",
  EXPORT_LOADING: "Exportando...",
  EXPORT_SUCCESS: "Marcas exportadas correctamente",
  EXPORT_ERROR: "Error al exportar las marcas: {{msg}}",
  // CSV bulk wizard
  BULK_TRIGGER: "Carga masiva CSV",
  BULK_TITLE: "Vincular productos a marcas de forma masiva",
  BULK_STEP1_TITLE: "Cómo funciona",
  BULK_STEP1_LINE1: "Descargá la plantilla CSV de abajo",
  BULK_STEP1_LINE2: "Completá el identificador del producto (o SKU de la variante) y el identificador de la marca",
  BULK_STEP1_LINE3: "Subí el archivo CSV completado",
  BULK_SMART_UPDATE_LABEL: "Actualización inteligente:",
  BULK_SMART_UPDATE_TEXT: "Los vínculos de marca existentes se reemplazarán por la nueva marca del CSV",
  BULK_STEP2_TITLE: "Descargar plantilla",
  BULK_DOWNLOAD_TEMPLATE: "Descargar plantilla CSV",
  BULK_STEP3_TITLE: "Subí tu CSV",
  BULK_UPLOAD_CLICK: "Hacé clic para seleccionar el archivo CSV",
  BULK_UPLOAD_DRAG: "o arrastrá y soltá tu archivo aquí",
  BULK_REMOVE_FILE: "Quitar archivo",
  BULK_RESULTS_TITLE: "Resultados del procesamiento",
  BULK_RESULTS_SUCCESS: "Exitosos",
  BULK_RESULTS_FAILED: "Fallidos",
  BULK_ERROR_DETAILS: "Detalle de errores:",
  BULK_ROW: "Fila {{row}}:",
  BULK_SUBMIT: "Procesar CSV",
  BULK_SUBMIT_LOADING: "Procesando...",
  BULK_TEMPLATE_DOWNLOADED: "Plantilla descargada correctamente",
  BULK_INVALID_FILE: "Seleccioná un archivo CSV",
  BULK_NO_FILE: "Seleccioná un archivo",
  BULK_NO_ROWS: "No se encontraron filas de datos válidas en el CSV",
  BULK_LINK_SUCCESS: "Se vincularon {{count}} productos a marcas correctamente",
  BULK_PROCESS_WITH_ERRORS: "Procesado con errores: {{success}} exitosos, {{failed}} fallidos",
  BULK_PROCESS_ERROR: "Error al procesar el CSV: {{msg}}",
  // Image section
  IMAGES_TITLE: "Imágenes de la marca",
  IMAGE_THUMBNAIL_LABEL: "Miniatura",
  IMAGE_THUMBNAIL_HELP: "Imagen principal de la marca que se muestra en los listados",
  IMAGE_ADDITIONAL_LABEL: "Imágenes adicionales",
  IMAGE_ADDITIONAL_HELP: "Imágenes de galería para la página de la marca",
  IMAGE_ADD_THUMBNAIL: "Agregar miniatura",
  IMAGE_ADD: "Agregar",
  IMAGE_UPLOADING: "Subiendo...",
  IMAGE_LOADING: "Cargando imágenes...",
  IMAGE_UPLOAD_SUCCESS: "Imagen subida correctamente",
  IMAGE_UPLOAD_ERROR: "Error al subir la imagen: {{msg}}",
  IMAGE_DELETE_SUCCESS: "Imagen eliminada correctamente",
  IMAGE_DELETE_ERROR: "Error al eliminar la imagen: {{msg}}",
  IMAGE_UPLOAD_FAILED: "Error al subir: {{msg}}",
  IMAGE_OR_URL: "O pegá una URL de imagen (recomendado — sobrevive a los deploys)",
  IMAGE_URL_PLACEHOLDER: "https://…/logo.png",
  IMAGE_URL_BUTTON: "Usar URL",
  IMAGE_URL_INVALID: "Ingresá una URL de imagen válida (http/https)",
  IMAGE_URL_SUCCESS: "Imagen asignada desde la URL"
};
const registerBrandsTranslations = (i18n) => {
  if (registered || typeof (i18n == null ? void 0 : i18n.addResourceBundle) !== "function") {
    return;
  }
  i18n.addResourceBundle("en", BRANDS_NAMESPACE, en, true, true);
  i18n.addResourceBundle("es", BRANDS_NAMESPACE, es, true, true);
  void i18n.loadNamespaces(BRANDS_NAMESPACE);
  registered = true;
};
const BrandImageSection = ({ brandId }) => {
  const { t, i18n } = reactI18next.useTranslation("brands");
  registerBrandsTranslations(i18n);
  const fileInputRef = react.useRef(null);
  const [isUploading, setIsUploading] = react.useState(false);
  const [thumbUrl, setThumbUrl] = react.useState("");
  const [extraUrl, setExtraUrl] = react.useState("");
  const [isSavingUrl, setIsSavingUrl] = react.useState(false);
  const { data, isPending, refetch } = useBrandImages(brandId);
  const images = (data == null ? void 0 : data.images) || [];
  const { mutateAsync: createImages } = useCreateBrandImages(brandId, {
    onSuccess: () => {
      ui.toast.success(t("IMAGE_UPLOAD_SUCCESS"));
      refetch();
    },
    onError: (error) => {
      ui.toast.error(t("IMAGE_UPLOAD_ERROR", { msg: error.message }));
    }
  });
  const { mutateAsync: deleteImage, isPending: isDeleting } = useDeleteBrandImage(brandId, {
    onSuccess: () => {
      ui.toast.success(t("IMAGE_DELETE_SUCCESS"));
      refetch();
    },
    onError: (error) => {
      ui.toast.error(t("IMAGE_DELETE_ERROR", { msg: error.message }));
    }
  });
  const thumbnailImage = images.find((img) => img.type === "thumbnail");
  const otherImages = images.filter((img) => img.type === "image");
  const handleAddUrl = async (rawUrl, type) => {
    const url = rawUrl.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      ui.toast.error(t("IMAGE_URL_INVALID"));
      return;
    }
    setIsSavingUrl(true);
    try {
      if (type === "thumbnail" && thumbnailImage) {
        await deleteImage(thumbnailImage.id);
      }
      await createImages({
        images: [{ type, url, file_id: `external:${url}` }]
      });
      ui.toast.success(t("IMAGE_URL_SUCCESS"));
      if (type === "thumbnail") setThumbUrl("");
      else setExtraUrl("");
    } catch (error) {
      ui.toast.error(t("IMAGE_UPLOAD_FAILED", { msg: (error == null ? void 0 : error.message) ?? "" }));
    } finally {
      setIsSavingUrl(false);
    }
  };
  const handleFileSelect = async (e, type) => {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const uploadResponse = await sdk.admin.upload.create({ files: [file] });
      if (uploadResponse.files && uploadResponse.files.length > 0) {
        const uploadedFile = uploadResponse.files[0];
        await createImages({
          images: [
            {
              type,
              url: uploadedFile.url,
              file_id: uploadedFile.id
            }
          ]
        });
      }
    } catch (error) {
      ui.toast.error(t("IMAGE_UPLOAD_FAILED", { msg: error.message }));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-ui-bg-base border border-ui-border-base rounded-lg p-6", children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h2", className: "mb-4", children: t("IMAGES_TITLE") }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-between mb-2", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "font-medium", children: t("IMAGE_THUMBNAIL_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Tooltip, { content: t("IMAGE_THUMBNAIL_HELP"), children: /* @__PURE__ */ jsxRuntime.jsx(icons.InformationCircleSolid, { className: "text-ui-fg-muted" }) })
        ] }) }),
        thumbnailImage ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative group w-32 h-32 rounded-lg overflow-hidden border border-ui-border-base", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "img",
            {
              src: thumbnailImage.url,
              alt: "Brand thumbnail",
              className: "w-full h-full object-cover"
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "cursor-pointer p-2 bg-white/20 rounded-full hover:bg-white/40 transition-colors", children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                "input",
                {
                  type: "file",
                  accept: "image/*",
                  className: "hidden",
                  onChange: async (e) => {
                    await deleteImage(thumbnailImage.id);
                    handleFileSelect(e, "thumbnail");
                  },
                  disabled: isUploading || isDeleting
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx(icons.Photo, { className: "w-4 h-4 text-white" })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                onClick: () => deleteImage(thumbnailImage.id),
                disabled: isDeleting,
                className: "p-2 bg-white/20 rounded-full hover:bg-red-500/80 transition-colors",
                children: /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "w-4 h-4 text-white" })
              }
            )
          ] })
        ] }) : /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-ui-border-base rounded-lg cursor-pointer hover:border-ui-border-interactive transition-colors", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "file",
              accept: "image/*",
              className: "hidden",
              onChange: (e) => handleFileSelect(e, "thumbnail"),
              disabled: isUploading
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(icons.Photo, { className: "w-8 h-8 text-ui-fg-subtle mb-2" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: isUploading ? t("IMAGE_UPLOADING") : t("IMAGE_ADD_THUMBNAIL") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mt-3 flex max-w-md items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              size: "small",
              placeholder: t("IMAGE_URL_PLACEHOLDER"),
              value: thumbUrl,
              onChange: (e) => setThumbUrl(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter" && thumbUrl.trim()) {
                  e.preventDefault();
                  void handleAddUrl(thumbUrl, "thumbnail");
                }
              }
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Button,
            {
              size: "small",
              variant: "secondary",
              disabled: !thumbUrl.trim() || isSavingUrl,
              onClick: () => handleAddUrl(thumbUrl, "thumbnail"),
              children: t("IMAGE_URL_BUTTON")
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-between mb-2", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "font-medium", children: t("IMAGE_ADDITIONAL_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Tooltip, { content: t("IMAGE_ADDITIONAL_HELP"), children: /* @__PURE__ */ jsxRuntime.jsx(icons.InformationCircleSolid, { className: "text-ui-fg-muted" }) })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap gap-3", children: [
          otherImages.map((image) => /* @__PURE__ */ jsxRuntime.jsxs(
            "div",
            {
              className: "relative group w-24 h-24 rounded-lg overflow-hidden border border-ui-border-base",
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("img", { src: image.url, alt: "Brand image", className: "w-full h-full object-cover" }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    onClick: () => deleteImage(image.id),
                    disabled: isDeleting,
                    className: "absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all",
                    children: /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "w-3 h-3 text-white" })
                  }
                )
              ]
            },
            image.id
          )),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-ui-border-base rounded-lg cursor-pointer hover:border-ui-border-interactive transition-colors", children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                ref: fileInputRef,
                type: "file",
                accept: "image/*",
                className: "hidden",
                onChange: (e) => handleFileSelect(e, "image"),
                disabled: isUploading
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(icons.Plus, { className: "w-6 h-6 text-ui-fg-subtle" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle mt-1", children: isUploading ? t("IMAGE_UPLOADING") : t("IMAGE_ADD") })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mt-3 flex max-w-md items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              size: "small",
              placeholder: t("IMAGE_URL_PLACEHOLDER"),
              value: extraUrl,
              onChange: (e) => setExtraUrl(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter" && extraUrl.trim()) {
                  e.preventDefault();
                  void handleAddUrl(extraUrl, "image");
                }
              }
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Button,
            {
              size: "small",
              variant: "secondary",
              disabled: !extraUrl.trim() || isSavingUrl,
              onClick: () => handleAddUrl(extraUrl, "image"),
              children: t("IMAGE_URL_BUTTON")
            }
          )
        ] })
      ] })
    ] }),
    isPending && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("IMAGE_LOADING") }) })
  ] });
};
const BrandEditDrawer = ({ brand, open, onOpenChange }) => {
  const { t, i18n } = reactI18next.useTranslation("brands");
  registerBrandsTranslations(i18n);
  const { data: detail } = useBrand(brand.id, void 0, { enabled: open });
  const source = (detail == null ? void 0 : detail.brand) ?? brand;
  const [name, setName] = react.useState(brand.name);
  const [handle2, setHandle] = react.useState(brand.handle);
  const [description, setDescription] = react.useState(brand.description || "");
  const [isActive, setIsActive] = react.useState(brand.is_active);
  const [salesChannelIds, setSalesChannelIds] = react.useState(
    brand.sales_channel_ids ?? []
  );
  const { mutateAsync: updateBrand, isPending } = useUpdateBrand(brand.id, {
    onSuccess: () => {
      ui.toast.success(t("UPDATE_SUCCESS"));
      onOpenChange(false);
    },
    onError: (error) => {
      ui.toast.error(t("UPDATE_ERROR", { msg: error.message }));
    }
  });
  react.useEffect(() => {
    if (open) {
      setName(source.name ?? "");
      setHandle(source.handle ?? "");
      setDescription(source.description || "");
      setIsActive(source.is_active ?? true);
      setSalesChannelIds(source.sales_channel_ids ?? []);
    }
  }, [open, source]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !handle2) {
      ui.toast.error(t("VALIDATION_REQUIRED"));
      return;
    }
    await updateBrand({
      name,
      handle: handle2,
      description: description || void 0,
      is_active: isActive,
      sales_channel_ids: salesChannelIds.length ? salesChannelIds : null
    });
  };
  return /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open, onOpenChange, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("EDIT_TITLE") }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Body, { className: "overflow-y-auto p-4", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "edit-brand-name", children: t("FIELD_NAME_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              id: "edit-brand-name",
              placeholder: t("FIELD_NAME_PLACEHOLDER"),
              value: name,
              onChange: (e) => setName(e.target.value),
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "edit-brand-handle", children: t("FIELD_HANDLE_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              id: "edit-brand-handle",
              placeholder: t("FIELD_HANDLE_PLACEHOLDER"),
              value: handle2,
              onChange: (e) => setHandle(e.target.value),
              required: true
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("FIELD_HANDLE_HELP") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "edit-brand-description", children: t("FIELD_DESCRIPTION_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Textarea,
            {
              id: "edit-brand-description",
              placeholder: t("FIELD_DESCRIPTION_PLACEHOLDER"),
              value: description,
              onChange: (e) => setDescription(e.target.value),
              rows: 3
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "edit-brand-active", children: t("FIELD_ACTIVE_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("FIELD_ACTIVE_HELP") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { id: "edit-brand-active", checked: isActive, onCheckedChange: setIsActive })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "border-t pt-4", children: /* @__PURE__ */ jsxRuntime.jsx(
          admin.SalesChannelMultiSelect,
          {
            value: salesChannelIds,
            onChange: setSalesChannelIds,
            label: "Canales de venta",
            help: "Vacío = visible en todos los canales."
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-6", children: /* @__PURE__ */ jsxRuntime.jsx(BrandImageSection, { brandId: brand.id }) })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", children: t("CANCEL") }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: handleSubmit, isLoading: isPending, children: t("EDIT_SUBMIT") })
    ] })
  ] }) });
};
const BrandActionsMenu = ({ brand }) => {
  const { t, i18n } = reactI18next.useTranslation("brands");
  registerBrandsTranslations(i18n);
  const prompt = ui.usePrompt();
  const [editOpen, setEditOpen] = react.useState(false);
  const { mutateAsync: deleteBrand } = useDeleteBrand(brand.id, {
    onSuccess: () => {
      ui.toast.success(t("DELETE_SUCCESS"));
    },
    onError: (error) => {
      ui.toast.error(t("DELETE_ERROR", { msg: error.message }));
    }
  });
  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t("DELETE_PROMPT_TITLE"),
      description: t("DELETE_PROMPT_DESCRIPTION", { name: brand.name }),
      confirmText: t("DELETE_PROMPT_CONFIRM"),
      cancelText: t("DELETE_PROMPT_CANCEL")
    });
    if (confirmed) {
      await deleteBrand();
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: () => setEditOpen(true), children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "text-ui-fg-subtle" }),
          t("ACTION_EDIT")
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Separator, {}),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2 text-ui-fg-error", onClick: handleDelete, children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "text-ui-fg-error" }),
          t("ACTION_DELETE")
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(BrandEditDrawer, { brand, open: editOpen, onOpenChange: setEditOpen })
  ] });
};
const BrandCreateDrawer = () => {
  const { t, i18n } = reactI18next.useTranslation("brands");
  registerBrandsTranslations(i18n);
  const [open, setOpen] = react.useState(false);
  const [name, setName] = react.useState("");
  const [handle2, setHandle] = react.useState("");
  const [description, setDescription] = react.useState("");
  const [isActive, setIsActive] = react.useState(true);
  const [salesChannelIds, setSalesChannelIds] = react.useState([]);
  const { mutateAsync: createBrand, isPending } = useCreateBrand({
    onSuccess: () => {
      ui.toast.success(t("CREATE_SUCCESS"));
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      ui.toast.error(t("CREATE_ERROR", { msg: error.message }));
    }
  });
  const resetForm = () => {
    setName("");
    setHandle("");
    setDescription("");
    setIsActive(true);
    setSalesChannelIds([]);
  };
  const generateHandle = (value) => {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };
  const handleNameChange = (value) => {
    setName(value);
    if (!handle2 || handle2 === generateHandle(name)) {
      setHandle(generateHandle(value));
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !handle2) {
      ui.toast.error(t("VALIDATION_REQUIRED"));
      return;
    }
    await createBrand({
      name,
      handle: handle2,
      description: description || void 0,
      is_active: isActive,
      sales_channel_ids: salesChannelIds.length ? salesChannelIds : null
    });
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer, { open, onOpenChange: setOpen, children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", children: t("CREATE_BUTTON") }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("CREATE_TITLE") }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Body, { className: "p-4", children: /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "name", children: t("FIELD_NAME_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              id: "name",
              placeholder: t("FIELD_NAME_PLACEHOLDER"),
              value: name,
              onChange: (e) => handleNameChange(e.target.value),
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "handle", children: t("FIELD_HANDLE_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              id: "handle",
              placeholder: t("FIELD_HANDLE_PLACEHOLDER"),
              value: handle2,
              onChange: (e) => setHandle(e.target.value),
              required: true
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("FIELD_HANDLE_HELP") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "description", children: t("FIELD_DESCRIPTION_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Textarea,
            {
              id: "description",
              placeholder: t("FIELD_DESCRIPTION_PLACEHOLDER"),
              value: description,
              onChange: (e) => setDescription(e.target.value),
              rows: 3
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "is_active", children: t("FIELD_ACTIVE_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("FIELD_ACTIVE_HELP") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { id: "is_active", checked: isActive, onCheckedChange: setIsActive })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "border-t pt-4", children: /* @__PURE__ */ jsxRuntime.jsx(
          admin.SalesChannelMultiSelect,
          {
            value: salesChannelIds,
            onChange: setSalesChannelIds,
            label: "Canales de venta",
            help: "Vacío = visible en todos los canales."
          }
        ) })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", children: t("CANCEL") }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: handleSubmit, isLoading: isPending, children: t("CREATE_SUBMIT") })
      ] })
    ] })
  ] });
};
const BrandCSVBulk = () => {
  const { t, i18n } = reactI18next.useTranslation("brands");
  registerBrandsTranslations(i18n);
  const queryClient = reactQuery.useQueryClient();
  const [open, setOpen] = react.useState(false);
  const [file, setFile] = react.useState(null);
  const [isProcessing, setIsProcessing] = react.useState(false);
  const [result, setResult] = react.useState(null);
  const fileInputRef = react.useRef(null);
  const downloadTemplate = () => {
    const headers = ["product_handle", "variant_sku", "brand_handle"];
    const exampleRow = ["my-product-handle", "SKU-001", "my-brand-handle"];
    const csvContent = [
      headers.join(","),
      exampleRow.join(","),
      "# product_handle or variant_sku is used to identify the product",
      "# brand_handle must match an existing brand handle"
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "brand_bulk_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ui.toast.success(t("BULK_TEMPLATE_DOWNLOADED"));
  };
  const handleFileChange = (e) => {
    var _a;
    const selectedFile = (_a = e.target.files) == null ? void 0 : _a[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        ui.toast.error(t("BULK_INVALID_FILE"));
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };
  const parseCSV = (text) => {
    const lines = text.split("\n").filter((line) => line.trim() && !line.startsWith("#"));
    if (lines.length === 0) throw new Error("CSV file is empty");
    const headers = lines[0].split(",").map((h) => h.trim());
    const requiredHeaders = ["brand_handle"];
    const hasValidHeaders = requiredHeaders.every((h) => headers.includes(h));
    if (!hasValidHeaders) {
      throw new Error(
        `Invalid CSV headers. Required: brand_handle. Optional: product_handle, variant_sku`
      );
    }
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const values = line.split(",").map((v) => v.trim());
      if (values.length < headers.length) continue;
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
    return rows;
  };
  const processCSV = async () => {
    if (!file) {
      ui.toast.error(t("BULK_NO_FILE"));
      return;
    }
    setIsProcessing(true);
    setResult(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        ui.toast.error(t("BULK_NO_ROWS"));
        setIsProcessing(false);
        return;
      }
      const response = await sdk.client.fetch("/admin/brands/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { items: rows }
      });
      if (!response) throw new Error("No response from server");
      setResult(response);
      if (response.failed === 0) {
        ui.toast.success(t("BULK_LINK_SUCCESS", { count: response.success }));
        queryClient.invalidateQueries({ queryKey: brandQueryKey.lists() });
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 2e3);
      } else {
        ui.toast.warning(
          t("BULK_PROCESS_WITH_ERRORS", {
            success: response.success,
            failed: response.failed
          })
        );
      }
    } catch (error) {
      ui.toast.error(t("BULK_PROCESS_ERROR", { msg: error.message }));
      console.error("Brand CSV bulk error:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  const resetForm = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer, { open, onOpenChange: setOpen, children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Button, { variant: "secondary", size: "small", children: [
      /* @__PURE__ */ jsxRuntime.jsx(icons.ArrowUpTray, {}),
      t("BULK_TRIGGER")
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Title, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("BULK_TITLE") }) }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Body, { className: "overflow-y-auto p-6", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-6", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center w-6 h-6 rounded-full bg-ui-fg-muted text-white text-xs font-bold", children: "1" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h3", className: "text-base font-semibold text-ui-fg-base", children: t("BULK_STEP1_TITLE") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "ml-8 space-y-2", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-start gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-muted mt-0.5", children: "→" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-sm text-ui-fg-muted", children: t("BULK_STEP1_LINE1") })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-start gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-muted mt-0.5", children: "→" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-sm text-ui-fg-muted", children: t("BULK_STEP1_LINE2") })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-start gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-muted mt-0.5", children: "→" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-sm text-ui-fg-muted", children: t("BULK_STEP1_LINE3") })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-3 p-3 bg-ui-bg-subtle border border-ui-border-base rounded", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { className: "text-xs text-ui-fg-muted", children: [
              /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "text-ui-fg-base", children: t("BULK_SMART_UPDATE_LABEL") }),
              " ",
              t("BULK_SMART_UPDATE_TEXT")
            ] }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center w-6 h-6 rounded-full bg-ui-fg-muted text-white text-xs font-bold", children: "2" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h3", className: "text-base font-semibold text-ui-fg-base", children: t("BULK_STEP2_TITLE") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "ml-8", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Button, { variant: "secondary", onClick: downloadTemplate, className: "w-full sm:w-auto", children: [
            /* @__PURE__ */ jsxRuntime.jsx(icons.ArrowDownTray, {}),
            t("BULK_DOWNLOAD_TEMPLATE")
          ] }) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center w-6 h-6 rounded-full bg-ui-fg-muted text-white text-xs font-bold", children: "3" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h3", className: "text-base font-semibold text-ui-fg-base", children: t("BULK_STEP3_TITLE") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "ml-8", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "border-2 border-dashed border-ui-border-base rounded-lg p-6 hover:border-ui-border-strong transition-colors bg-ui-bg-subtle", children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                "input",
                {
                  ref: fileInputRef,
                  id: "brand-csv-file",
                  type: "file",
                  accept: ".csv",
                  onChange: handleFileChange,
                  className: "hidden"
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsxs(
                "label",
                {
                  htmlFor: "brand-csv-file",
                  className: "flex flex-col items-center justify-center cursor-pointer",
                  children: [
                    /* @__PURE__ */ jsxRuntime.jsx(icons.ArrowUpTray, { className: "w-10 h-10 text-ui-fg-muted mb-3" }),
                    /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-sm font-medium text-ui-fg-base mb-1", children: t("BULK_UPLOAD_CLICK") }),
                    /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-xs text-ui-fg-muted", children: t("BULK_UPLOAD_DRAG") })
                  ]
                }
              )
            ] }),
            file && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mt-3 p-3 bg-ui-bg-subtle border border-ui-border-base rounded flex items-center justify-between", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-base", children: "✓" }),
                /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-sm font-medium text-ui-fg-base", children: file.name }),
                  /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { className: "text-xs text-ui-fg-muted", children: [
                    (file.size / 1024).toFixed(2),
                    " KB"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx(
                "button",
                {
                  onClick: resetForm,
                  className: "text-ui-fg-error hover:text-ui-fg-error transition-colors",
                  title: t("BULK_REMOVE_FILE"),
                  children: /* @__PURE__ */ jsxRuntime.jsx(icons.XMark, { className: "w-5 h-5" })
                }
              )
            ] })
          ] })
        ] }),
        result && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center w-6 h-6 rounded-full bg-ui-fg-muted text-white text-xs font-bold", children: "✓" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h3", className: "text-base font-semibold text-ui-fg-base", children: t("BULK_RESULTS_TITLE") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "ml-8 space-y-3", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "p-4 bg-ui-bg-subtle border border-ui-border-base rounded", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-sm font-bold text-ui-fg-muted mb-1", children: t("BULK_RESULTS_SUCCESS") }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-2xl font-bold text-ui-fg-base", children: result.success })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "p-4 bg-ui-bg-subtle border border-ui-border-base rounded", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-sm font-bold text-ui-fg-muted mb-1", children: t("BULK_RESULTS_FAILED") }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-2xl font-bold text-ui-fg-base", children: result.failed })
              ] })
            ] }),
            result.errors.length > 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "p-4 bg-ui-bg-subtle border border-ui-border-base rounded", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-sm font-semibold text-ui-fg-base mb-2", children: t("BULK_ERROR_DETAILS") }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "max-h-40 overflow-y-auto space-y-1", children: result.errors.map((err, idx) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "text-xs text-ui-fg-muted flex gap-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-ui-fg-base", children: t("BULK_ROW", { row: err.row }) }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: err.error })
              ] }, idx)) })
            ] })
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", onClick: resetForm, children: t("CANCEL") }) }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Button,
          {
            onClick: processCSV,
            isLoading: isProcessing,
            disabled: !file,
            className: "flex-1 sm:flex-none",
            children: isProcessing ? t("BULK_SUBMIT_LOADING") : t("BULK_SUBMIT")
          }
        )
      ] })
    ] })
  ] });
};
const BrandExport = () => {
  const { t, i18n } = reactI18next.useTranslation("brands");
  registerBrandsTranslations(i18n);
  const [isExporting, setIsExporting] = react.useState(false);
  const exportBrands = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/admin/brands/export", {
        method: "GET",
        credentials: "include"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const csvText = await response.text();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `brand_associations_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      ui.toast.success(t("EXPORT_SUCCESS"));
    } catch (error) {
      ui.toast.error(t("EXPORT_ERROR", { msg: error.message }));
      console.error("Brand export error:", error);
    } finally {
      setIsExporting(false);
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Button, { variant: "secondary", size: "small", onClick: exportBrands, disabled: isExporting, children: [
    /* @__PURE__ */ jsxRuntime.jsx(icons.ArrowDownTray, {}),
    isExporting ? t("EXPORT_LOADING") : t("EXPORT_BUTTON")
  ] });
};
const PAGE_SIZE = 20;
const columnHelper = ui.createDataTableColumnHelper();
const Brands = () => {
  const { t, i18n } = reactI18next.useTranslation("brands");
  registerBrandsTranslations(i18n);
  const [editingBrand, setEditingBrand] = react.useState(null);
  const [search, setSearch] = react.useState("");
  const [pagination, setPagination] = react.useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useBrands({
    limit: pagination.pageSize,
    offset,
    q: search || void 0
  });
  const brands = (data == null ? void 0 : data.brands) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const columns = react.useMemo(
    () => [
      columnHelper.accessor("name", {
        header: t("COLUMN_NAME"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium", children: getValue() })
      }),
      columnHelper.accessor("handle", {
        header: t("COLUMN_HANDLE"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-subtle", children: getValue() })
      }),
      columnHelper.accessor("description", {
        header: t("COLUMN_DESCRIPTION"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "block max-w-xs truncate", children: getValue() || "-" })
      }),
      columnHelper.accessor("is_active", {
        header: t("COLUMN_STATUS"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: getValue() ? "green" : "grey", children: getValue() ? t("STATUS_ACTIVE") : t("STATUS_INACTIVE") })
      }),
      columnHelper.display({
        id: "actions",
        header: t("COLUMN_ACTIONS"),
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntime.jsx(BrandActionsMenu, { brand: row.original }) })
      })
    ],
    [t]
  );
  const table = ui.useDataTable({
    columns,
    data: brands,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination
    },
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      }
    },
    onRowClick: (_event, row) => setEditingBrand(row)
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(admin.SiteScopeBar, { screen: "brands" }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "p-0", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable, { instance: table, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-x-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("TITLE") }),
          /* @__PURE__ */ jsxRuntime.jsx(admin.ExtensionVersion, { extension: "brands" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Search, { placeholder: t("SEARCH_PLACEHOLDER") }),
          /* @__PURE__ */ jsxRuntime.jsx(BrandExport, {}),
          /* @__PURE__ */ jsxRuntime.jsx(BrandCSVBulk, {}),
          /* @__PURE__ */ jsxRuntime.jsx(BrandCreateDrawer, {})
        ] })
      ] }),
      count > 0 || isPending ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Table, {}),
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Pagination, {})
      ] }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: t("EMPTY_STATE") }) })
    ] }) }),
    editingBrand && /* @__PURE__ */ jsxRuntime.jsx(
      BrandEditDrawer,
      {
        brand: editingBrand,
        open: !!editingBrand,
        onOpenChange: (open) => {
          if (!open) setEditingBrand(null);
        }
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const BrandsIcon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.TagSolid, { style: { color: "#7270F5" } });
const config = adminSdk.defineRouteConfig({
  label: "Marcas",
  icon: BrandsIcon,
  rank: 10
});
const handle = {
  breadcrumb: () => "Marcas"
};
const BrandDetail = () => {
  const navigate = reactRouterDom.useNavigate();
  react.useEffect(() => {
    navigate("/brands", { replace: true });
  }, [navigate]);
  return null;
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: Brands,
      path: "/brands",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    },
    {
      Component: BrandDetail,
      path: "/brands/:brand_id"
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/brands",
      nested: void 0,
      rank: 10,
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
module.exports = plugin;
