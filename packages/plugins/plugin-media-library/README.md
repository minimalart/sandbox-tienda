# @minimalart/mercatto-plugin-media-library

Catálogo de imágenes (media assets) para tiendas Mercatto (Medusa 2.18+). Administra FILAS: una por imagen, con su URL, nombre y tamaño. **No es storage** — el archivo lo sube y lo sirve el módulo File del core de Medusa, que es quien habla con S3.

Consecuencia clave: borrar un asset saca la fila del catálogo y NO borra el archivo del bucket. Cualquier URL ya publicada sigue funcionando.

## Ships

- `media_library` module con un modelo `media_asset` (id, url, filename, file_id, mime_type, size, alt, title, source, metadata).
- Admin route `/app/media-library` con listado paginado, búsqueda por filename, selección múltiple y editor de imagen (crop + smartcrop + resize + export webp/jpeg).
- Widget `product.details.after`: pickear imágenes de la Biblioteca y adjuntarlas al producto (merge + dedup por URL).
- Admin API: `GET/POST /admin/media-library`, `GET/POST/DELETE /admin/media-library/:id`, `POST /admin/media-library/attach`, `POST /admin/media-library/backfill`, `GET /admin/media-library/proxy?url=…`.

## Los dos providers de archivo

- **S3** — si `S3_BUCKET` está seteado. Se registra el provider S3 del core.
- **LOCAL** — si `S3_BUCKET` no está seteado. Los archivos van al disco del contenedor y son **efímeros** en deploys con contenedores.

Si las imágenes de un ambiente desaparecen sin explicación, es lo primero que hay que mirar.

## Install

```
pnpm add @minimalart/mercatto-plugin-media-library
```

Then register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-media-library', options: {} },
]
```

El backfill (`POST /admin/media-library/backfill`) recorre las imágenes de todos los productos y las importa al catálogo dedupeando por URL. Es idempotente.

## Environment variables

Toda la configuración de S3 son opciones del provider de archivos del core; se evalúan al arrancar. No hay panel editable — se lista para que sepas dónde mirar.

| Var | Descripción |
| --- | --- |
| `S3_BUCKET` | Nombre del bucket. Si vacío → provider LOCAL. |
| `S3_REGION` | Región del bucket. |
| `S3_ACCESS_KEY_ID` | Credencial. |
| `S3_SECRET_ACCESS_KEY` | Credencial. |
| `S3_ENDPOINT` | Servicio compatible S3 al que se conecta. Alias: `S3_URL` (gana `S3_ENDPOINT`). |
| `S3_URL` | Alias legacy de `S3_ENDPOINT`. Ignorado si `S3_ENDPOINT` está seteado. |
| `S3_FILE_URL` | URL pública base (típicamente CDN). Si vacía, se sirve desde el endpoint del bucket. Alias: `S3_PUBLIC_URL`. |
| `S3_PUBLIC_URL` | Alias legacy de `S3_FILE_URL`. Ignorado si `S3_FILE_URL` está seteado. |
| `S3_PREFIX` | Carpeta raíz dentro del bucket. Cambiarlo con assets ya subidos los deja huérfanos (las filas del catálogo guardan URL COMPLETA y no se reescriben). |
| `S3_FORCE_PATH_STYLE` | `true` para path-style (algunos S3-compatibles lo requieren). |

Setear los dos nombres de un alias con valores distintos no configura dos cosas: la segunda se ignora en silencio.

## Consumer subpath exports

El plugin exporta piezas UI para que el host las reuse sin duplicar código:

```ts
// Picker reutilizable (email branding, Puck blocks, etc.)
import { MediaLibraryPickerModal } from '@minimalart/mercatto-plugin-media-library/admin/components/media-library-picker';

// Hooks React Query para consumidores custom
import {
  useMediaAssets,
  useAttachToProduct,
} from '@minimalart/mercatto-plugin-media-library/admin/hooks/media-library';

// Editor de imagen (por si otro widget lo quiere invocar)
import { ImageEditorModal } from '@minimalart/mercatto-plugin-media-library/admin/lib/image-editor';
```

## Multi-tenant

No. Un catálogo por instancia; UN bucket para toda la instalación. La `S3_FILE_URL` la lee además la extensión de email templates para el logo del kit — si se instala email-templates sin media-library, hay que setearla igual.
