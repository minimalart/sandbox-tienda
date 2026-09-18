# Marketing & Privacy — fases 1–3

## Implementación

`Marketing & Privacy` reúne Analítica, Marketing, Newsletter y Privacidad y cookies. Newsletter conserva sus APIs, datos, credenciales y consentimiento de suscripción independientes. Marketing no instala providers futuros.

- `consent-management` es una extensión opcional, sin dependencias de GA4 ni Newsletter. Su payload contiene el adaptador CookieConsent, estilos y prueba de navegador.
- El contrato estable de Brick vive en `apps/storefront/src/lib/consent`: categorías extensibles, `ConsentAwareService`, `useConsent`, `canLoadService` y `openConsentPreferences`.
- `privacy-slot.tsx` y `marketing-privacy-capabilities.ts` los genera el composer. Sin Consent Management no se importa el engine, no se instala su dependencia y no aparece el banner. El footer sólo importa el contrato de Brick.
- GA4 deja de ser una dependencia obligatoria de los templates: se selecciona explícitamente al componer. Las instalaciones existentes conservan su integración y fallback ENV.
- El banner anterior, que persistía un booleano sin bloquear trackers, ya no se monta. El nuevo comportamiento requiere activación explícita en Privacidad y cookies.
- Los enlaces anteriores redirigen a las nuevas subpáginas; `cookie_banner_enabled` se conserva en la API para clientes anteriores. Las preferencias se reabren tanto desde el footer principal como desde el footer del sidebar B2B.

## Configuración y aislamiento

Se reutilizan `site_setting`, los descriptores y `/admin/app-settings`:

| Namespace | Clave | Contenido |
| --- | --- | --- |
| `extension:consent-management` | `CONFIG` | Estado, estrategia, revisión, categorías, textos ES/EN y enlaces legales |
| `extension:ga4` | `STOREFRONT_CONFIG` | `enabled`, `measurementId`, `consentCategory: analytics` |

El namespace GA4 existente sigue conteniendo, por separado, su configuración privada de Measurement Protocol. El nuevo endpoint público `/store/marketing-privacy` usa una lista explícita de campos públicos: nunca serializa claves privadas, secretos ni campos adicionales del objeto almacenado.

La tienda principal aplica tienda → global → ENV legacy del storefront para GA4. Una secundaria sin configuración propia permanece apagada y nunca hereda el ID global o de la ENV. Un `enabled: false` persistido tiene precedencia sobre la ENV. Consentimiento utiliza las mismas reglas de aislamiento existentes del boilerplate: las secundarias requieren configuración propia.

Los errores de configuración bloquean la medición; no se interpretan como ausencia del módulo. Una tienda desconocida no degrada a la principal. Las respuestas públicas no se cachean entre tiendas. La cookie de consentimiento incluye el ID inmutable de tienda, es host-only y verifica `consentRevision`.

Next conserva el layout raíz entre navegaciones: `PrivacyRoot` detecta cambios de prefijo `/demo/{slug}`, bloquea inmediatamente los eventos de la cuenta anterior y obtiene la nueva configuración mediante `/api/store/privacy`. Los eventos también validan el prefijo actual antes de enviarse.

## Comportamiento

- **Opt-in:** categorías opcionales bloqueadas hasta una elección válida. No se inserta `gtag.js` antes del permiso Analytics.
- **Opt-out:** categorías habilitadas activas inicialmente; una elección explícita de rechazo prevalece.
- **Informativo:** aviso sin bloqueo. No ofrece un botón de rechazo que prometa detener servicios; las categorías del engine son de sólo lectura.
- Necessary siempre está habilitada y no es editable. Las categorías desactivadas o desconocidas no habilitan servicios.
- La edición de una categoría incrementa la revisión. El administrador también puede incrementar la revisión al cambiar finalidades o servicios.
- `showPreferences` controla el botón del banner; el acceso posterior a preferencias sigue disponible para poder revocar una elección.
- CookieConsent administra persistencia, aceptación, rechazo y preferencias. Brick publica `consent:first`, `consent:changed`, `consent:accepted`, `consent:rejected`; no los envía automáticamente a Analytics.
- Los textos del engine usan el idioma del documento del storefront (ES/EN). Sus colores consumen tokens; un template con tema local puede marcar su contenedor con `data-storefront-theme`, como el portal B2B.
- GA4 inicializa Consent Mode antes de su configuración. Analytics controla `analytics_storage`; Marketing controla `ad_storage`, `ad_user_data` y `ad_personalization`. Revocar actualiza esos permisos y `ga-disable-{id}`, y bloquea los helpers de eventos. Los eventos se dirigen expresamente al ID seleccionado.
- El loader heredado de GTM no se ejecuta cuando el consentimiento está activo. Clarity usa ahora un adaptador propio descrito abajo.

## Eventos de backend y publicación

Los eventos de Medusa pueden conservar un `ga_client_id` de una visita anterior. Ese identificador no prueba consentimiento vigente. El plugin GA4 consulta el contrato opcional `consent/event-permission` del host antes de sus dos dispatchers. Sin el contrato conserva su compatibilidad anterior.

En tiendas con opt-in u opt-out activo, los eventos de Measurement Protocol sin evidencia vigente se suprimen, incluso después de una aceptación en el navegador. Esta fase no incorpora evidencia individual server-side ni la sincronización necesaria para habilitarlos con seguridad. La medición de navegación y los eventos del navegador siguen funcionando tras aceptar. El puente del storefront deja de copiar `_ga` a nuevos carritos/contactos cuando la estrategia necesita evidencia individual.

**El cambio del plugin GA4 está en su fuente y changelog Unreleased: hay que compilarlo y publicarlo junto con el host antes de activar esta protección en una instalación que consume el paquete npm publicado.** No se realizó publicación ni despliegue.

## Validación

- Unit/integration: categorías, estrategias, permisos, Consent Mode, configuración pública, validación, precedencia por tienda, permiso server-side y el contrato opcional del plugin.
- Navegador Chrome, componentes reales y peticiones a Google interceptadas: rechazo y recarga, aceptación, `page_view` SPA, revocación, dos tiendas, cambio de tienda sin recarga, nueva revisión, ES/EN, opt-out y módulo desactivado.
- Admin en un fixture con APIs simuladas: overview, Drawer de categorías, Necessary bloqueada, guardado, cambio de tienda, Drawer GA4, ES/light y EN/dark. No equivale a una prueba contra una base de datos real.
- Composer: minimal, newsletter, consent, analytics, consent+analytics y full; comprobación de imports opcionales y del payload.
- Chequeo de tipos aislado de las nuevas superficies de storefront/Admin. La verificación completa del repo y la matriz `install/typecheck/build` no están certificadas: hay dependencias ausentes en el checkout; `@minimalart/mercatto-plugin-storefront-recommendations` y, al instalar la composición mínima, `@minimalart/mercatto-plugin-loyalty` devuelven 403 con la credencial disponible. El build del storefront no llega a compilar porque falta el binario instalado de Next. No se sustituyeron esos paquetes por stubs para declarar un build válido.

Pruebas reproducibles:

```powershell
# Desde apps/storefront
node --experimental-transform-types --import ./test-register.mjs --test src/lib/consent/contract.test.ts src/lib/analytics/consent.test.ts
pnpm test:privacy:browser
# PLAYWRIGHT_CHANNEL=chrome permite usar Chrome instalado; por defecto usa Chromium de Playwright.

# Desde apps/backend
node --experimental-transform-types --import ./test-register.mjs --test src/lib/marketing-privacy-public.test.ts

# Desde la raíz
node --test packages/project-composer/src/privacy-integrations.test.js
node packages/project-composer/src/verify-components.js consent-management
node packages/project-catalog/src/validate.js
```

Referencias del adaptador: [CookieConsent configuration](https://cookieconsent.orestbida.com/reference/configuration-reference.html) y [Google Consent Mode](https://developers.google.com/tag-platform/security/guides/consent).

## Clarity y Google Merchant Center

Ambas capacidades son extensiones opcionales (`clarity`, `google-merchant`) del catálogo. Se configuran en Marketing & Privacy por tienda y no dependen de GA4, Newsletter o Consent Management. Sin la extensión seleccionada, el composer omite sus rutas/adaptadores y oculta sus ajustes. El módulo core `marketing-report` guarda solamente cachés de informes y feeds, nunca tokens.

### Referencias revisadas

- Clarity: stash `2c968354` de `saphirus-b2b-front`, `ClarityAnalyticsApplicationService.ts`, `ClarityAnalyticsView.tsx` y `scripts/clarity_iceberg_sync.py`. La referencia guardaba histórico en Supabase/Iceberg con GitHub Actions. Esta integración usa la API de exportación directamente y muestra una ventana móvil de 72 horas: no promete histórico ni suma ventanas superpuestas. No requiere Supabase, buckets ni acciones externas.
- Merchant: `aec-chile-backend/backoffice/src/utils/google-merchant-feed.ts` y `workflows/google-feed/generate-feed.ts`. Era un feed Google Merchant, no una integración de Meta. Se adaptó el formato RSS/XML y la agrupación por variante. No se copiaron dominio, moneda, redondeo CLP ni el stock global de AEC.

### Microsoft Clarity

En la card Clarity, habilitar el proveedor, ingresar Project ID y, para las métricas, su token **Data Export API**. El token se guarda mediante el tipo `secret` de app-settings; el endpoint público sólo expone enabled, projectId y categoría analytics. Un token vacío conserva el anterior; el switch de borrado lo elimina explícitamente.

El storefront carga el tag únicamente cuando `analytics` está permitido. Comunica `consentv2` y detiene la captura al revocar o cambiar de tienda. La navegación dentro de una tienda conserva la sesión. Si un documento que ya cargó Clarity debe activar otro proyecto/tienda, realiza una recarga completa para aislar el estado global del SDK. No envía identificadores de clientes. La ENV `NEXT_PUBLIC_CLARITY_PROJECT_ID` se conserva como fallback sólo en la tienda principal, con la extensión instalada y sin configuración guardada; un `enabled:false` persistido la anula.

`GET /admin/marketing-privacy/clarity` consulta un reporte fijo de 72 horas y lo cachea seis horas en PostgreSQL. Un lock transaccional evita consultas simultáneas desde varios workers. Los errores y respuestas 429 también se cachean; cambiar el token permite corregir una configuración fallida. No se devuelve el body de errores de Microsoft. El panel muestra sesiones sin bots, páginas por sesión, profundidad de scroll, tiempo activo y tablas de métricas disponibles; campos ausentes se muestran como “—”, nunca como cero inventado. La API limita el export a 1.000 filas sin paginación; la paginación de la tabla es sólo local.

Fuentes: [Clarity Data Export API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api), [ConsentV2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2), [start/stop del SDK](https://github.com/microsoft/clarity/blob/master/packages/clarity-js/src/clarity.ts).

### Google Merchant Center

En su Drawer, configurar la URL pública completa del storefront (incluido `/ar`, `/cl` o el prefijo de la tienda), región, canal de ventas, ubicación de stock y una marca de fallback opcional. El backend valida que región/canal/ubicación correspondan a la tienda y que la ubicación esté vinculada al canal. No hay selección implícita de la primera región disponible.

“Verificar feed” devuelve cantidades, fecha, moneda, hasta 100 variantes omitidas con sus motivos y la URL pública `/feeds/google-merchant/<site_id>`. Copiar esa URL como fuente programada en Merchant Center. En instalaciones sin registro de tiendas se usa `main`. No se conectó ninguna cuenta real de Google ni se crearon fuentes externas.

El feed:

- Incluye sólo productos publicados del canal seleccionado, con ID estable de variante e item_group_id del producto. Excluye variantes Bulto, igual que el selector B2C existente.
- Enlaza `?variant=<id>`; el selector del storefront respeta la variante solicitada si es vendible.
- Conserva precios decimales y ofertas de la región. Exige precios configurados como tax-inclusive: no agrega un IVA supuesto ni publica un precio excluyendo impuestos. Omite precios ausentes, inválidos o en otra moneda.
- Evalúa todos los componentes de inventario y su required_quantity únicamente en la ubicación configurada; no utiliza stock de otra tienda. Los backorders necesitan una fecha futura en `variant.metadata.availability_date`. Respeta restricciones comerciales del importador.
- Exige título, descripción, imagen HTTP(S), y GTIN con dígito verificador válido o marca + MPN. Un producto sin identificadores debe declararlo explícitamente con `product.metadata.identifier_exists=false`. Nunca inventa GTIN/MPN a partir del SKU.
- Lee marca de metadata de variante/producto o fallback, MPN y google_product_category de metadata. Escapa XML y limita longitudes. Los atributos de variante color/size/material/pattern se incluyen cuando existen.
- Regenera bajo demanda con caché de 15 minutos y lock compartido. Desactivar el feed se comprueba antes de consultar la caché; la respuesta HTTP no se cachea públicamente.

Especificación utilizada: [Google Merchant Product Data](https://support.google.com/merchants/answer/7052112?hl=es).

### Instalación y comprobaciones adicionales

Aplicar la nueva migración con el flujo habitual de `medusa db:migrate`: `Migration20260916120000MarketingReport` crea `marketing_report_cache`. No se ejecutó sobre una base real en esta tarea; Docker local no estaba disponible.

Se verificaron pruebas unitarias del feed/configuración/reportes, registro de descriptores y manifests, tipos de las superficies nuevas, consentimiento Clarity en Chrome con vendor interceptado, y Admin real en un fixture de API (métricas, token, guardado Merchant, cambio de tienda, ES/EN y light/dark). No equivalen a una importación aprobada en Merchant Center ni a una consulta con un token real de Microsoft. Sigue pendiente el build completo por las dependencias privadas descritas arriba.

```powershell
node --experimental-transform-types --import ./apps/backend/test-register.mjs --test apps/backend/src/lib/marketing-providers.test.ts
node packages/project-composer/src/verify-components.js clarity google-merchant consent-management
```

## Navegación

Marketing & Privacy es el único acceso lateral a Google Merchant Center, Newsletter, Microsoft Clarity, Credenciales, Privacidad y cookies y GA4. Newsletter y GA4 reutilizan sus pantallas; permanecen opcionales. Credenciales abre Site Credentials. Store Config ya no muestra la pestaña Tienda. Los enlaces anteriores se conservan como redirecciones sin entradas de menú. El logo de Merchant procede del asset oficial de Google: https://www.gstatic.com/images/branding/productlogos/merchant_center/v8/192px.svg.
