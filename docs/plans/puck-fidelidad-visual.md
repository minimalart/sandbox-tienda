# Plan: Puck con fidelidad al storefront

Fecha: 23 de septiembre de 2026. Análisis del checkout `codex/landingsv5`, HEAD `921211b9b`, incluidos sus cambios locales. Documento de planificación; no se modificó la implementación ni se verificó producción.

## Decisión propuesta

Mantener Puck y convertir el lienzo en una composición de las mismas vistas que utiliza la web: mismo HTML visual, CSS, fuentes, tokens, anchos y datos resueltos. Complementarlo con una vista previa de página completa que utilice el renderer del storefront y acepte cambios sin guardar.

Son dos entregables distintos. Una vista previa externa fiel ayuda a comprobar el resultado, pero no resuelve por sí sola la edición abstracta. El objetivo final incluye seleccionar, reordenar y editar sobre bloques visualmente fieles.

## Diagnóstico comprobado en código

| Superficie | Implementación actual | Diferencia que explica la abstracción |
| --- | --- | --- |
| Landings | El plugin define `render` con estilos inline; el storefront mantiene otro mapa de componentes. | Dos implementaciones visuales independientes. El editor no carga el tema ni el CSS del storefront. |
| Productos de landing | `ProductsList` dibuja cajas con la palabra «producto», hasta 8, en 4 columnas. | La web consulta Typesense, usa `CompactProductCard`, respeta hasta 24 productos y cambia de 2 a 3 y 4 columnas. |
| Home de tiendas/campañas | `SectionCard`, `PlaceCard` y `skeletonRow` resumen las secciones. | El storefront monta banners, categorías, productos, marcas, blog, videos y campaña con sus componentes reales. |
| Directorio | Todos los tipos se representan con una tarjeta genérica de Medusa. El `root.render` no aplica sus colores. | La web tiene header, hero dividido, búsqueda, tarjetas de tiendas, beneficios y footer; aplica su configuración visual. |
| Emails | El lienzo tiene representaciones propias; existe una vista previa HTML con el diseño actual y datos de ejemplo. | Es el mejor precedente de preview fiel, aunque exige abrir un drawer y actualizarlo. Los controles de viewport del lienzo están ocultos. |

Ejemplos concretos de desvío:

- Landing: contenedor inline de 1024 px frente a `max-w-6xl` en la web; Hero de 280 px mínimos frente a 320; título fijo de 44 px frente a tamaños responsive. El acento por defecto del editor es `#2e7d32`.
- `ImageTextPreview` y `ImageText` duplican estructura, espaciado y tipografía. El primero usa variables `--ui-*` del Admin para el CTA; el segundo usa el botón del storefront.
- En Home, `CampaignHero` muestra título y un resumen de badges/CTA, sin representar su imagen y composición reales.
- `ProductGrid` no es una grilla real ni siquiera en el storefront: presenta un título y enlace. La grilla dinámica es `ProductsList`. Es necesario corregir la expectativa del nombre antes de ampliar su comportamiento.
- El link «Vista previa» de landings apunta a `/l/{slug}` sin transportar el documento actual. El lector público filtra `status: published` y el fetch del storefront revalida cada 60 segundos. En este checkout no se encontró preview de borradores en esa ruta.
- Home y Directorio también abren una URL pública: sus links no transmiten el estado sin guardar.
- El modelo de landing tiene un único `puck_data`, sin snapshot publicado separado. No se debe asumir que «guardar borrador» sobre una landing publicada deja intacto su contenido público; ese contrato debe quedar explícito.

## Arquitectura

### 1. Compartir presentación y resolución de contenido

Separar cada bloque en tres responsabilidades:

1. **Contrato:** props persistidas, defaults compatibles, validación y correspondencia de tipos. Compartirlo entre editor, renderer y esquema de generación IA.
2. **Resolución:** convertir referencias y configuración en datos listos para mostrar, usando las mismas reglas de tienda, canal, país, moneda, idioma, template y visibilidad que la web.
3. **Vista:** componente presentacional y estilos compartidos, consumidos por editor y storefront.

Comenzar con `Hero`, `ImageText`, `FeatureGrid`, `CTA`, `RichText`, `ImageBlock`, `FAQ`, `Testimonials` y `Spacer`. Conservar los nombres/props de documentos existentes.

Usar el paquete existente `packages/contracts/storefront-shared` cuando corresponda a primitivas portables, mediante exports específicos. Los bloques opcionales deben permanecer bajo ownership de su capacidad; no incorporar todo el plugin de landings como dependencia obligatoria del núcleo. Si hace falta un paquete visual adicional, justificarlo con los primeros consumidores, sin crear un framework nuevo.

No importar directamente desde el Admin componentes async de Next, `server-only`, cookies o `getActiveTenant`. Extraer sus vistas y exponer datos mediante un adaptador autorizado. Los links y acciones del storefront necesitan adaptadores de edición para conservar selección y drag-and-drop.

Los datos resueltos de catálogo, precios e inventario pertenecen al estado transitorio del preview; no persistirlos dentro de `puck_data`. El documento conserva selección, filtros y overrides editoriales.

### 2. Tema y estilos dentro del lienzo

- Obtener el contexto de la entidad editada, no inferirlo de la tienda activa del Admin. Una landing global debe permitir elegir una tienda para previsualizar sin cambiar su alcance de publicación.
- Entregar CSS visual versionado, fuentes y tokens desde la misma fuente usada por el storefront. Incluir estilos específicos del template cuando corresponda.
- Aplicarlos exclusivamente al documento del lienzo y evitar que el reset, tipografía o modo oscuro de Medusa cambien el contenido. No inyectar el Tailwind completo de la web globalmente en el Admin.
- Usar los mismos contenedores, breakpoints, recortes de imagen y variantes de botones. Ofrecer anchos de prueba explícitos: 390, 768 y 1440 px, además del ajuste de zoom.
- Mantener las guías, nombres de sección y mensajes administrativos como overlays o paneles de Puck, fuera del layout del contenido.

El repo declara `@measured/puck` 0.20.2. Esa versión ya tiene iframe y viewports, y su implementación replica estilos del host. Por lo tanto, «activar el iframe» no alcanza. La documentación actual tiene opciones adicionales de aislamiento que deben comprobarse contra la versión elegida antes de utilizarlas. Hacer una prueba técnica acotada; si requiere actualización, tratarla como cambio explícito y probar carga, guardado, undo/redo y drag-and-drop de documentos existentes.

### 3. Datos reales y estados honestos

- Resolver `ProductsList` con el mismo filtro, orden, límite y contexto comercial de la web. Reutilizar la vista de la tarjeta real y su formato monetario.
- Resolver Home con los mismos merges entre assets del template y props del bloque. No duplicar nuevamente reglas como `hasBlockSearch` en una API de preview distinta.
- Mostrar banners, marcas, blog, videos y looks reales. El panel del bloque puede incluir «Editar banners» o «Editar marcas», manteniendo sus pantallas como fuente de contenido.
- Mostrar loading sólo durante la carga. Distinguir catálogo vacío, sección oculta por configuración, referencia inválida y error del proveedor; el mensaje de diagnóstico aparece en el editor sin alterar la página pública.
- Agrupar consultas, cachear por contexto y filtro, cancelar respuestas viejas y evitar consultar catálogo por cada tecla de un título. Revalidar al cambiar una selección o pedir actualización.
- No sustituir silenciosamente contenido por productos de otra tienda o ejemplos. Los ejemplos deben ser una elección visible cuando no existe catálogo.

### 4. Preview de página completa con cambios sin guardar

Crear un mecanismo transitorio de preview que reciba documento y contexto autorizados y renderice la página con su shell real: header, footer, fuentes, template y datos. Reutilizar `LandingRenderer`, `HomeRenderer` y el renderer del directorio.

- Sesión de preview breve, vinculada al usuario autorizado y a la entidad; sin publicar ni modificar la versión pública. Si se usa token, limitar duración, alcance y reutilización.
- Actualizar desde `onChange` con debounce, número de revisión y descarte de respuestas obsoletas. El editor debe indicar si la vista corresponde a una revisión anterior.
- Evitar caché pública, indexación y analítica comercial para esta sesión. La autorización se valida en servidor, no sólo con un `siteId` o un parámetro `preview=1`.
- Si Admin y storefront tienen distintos orígenes, usar un protocolo explícito con `postMessage`, origen permitido y validación de payload. No asumir acceso directo al DOM del iframe remoto ni que reemplazar el iframe interno de Puck por una URL conserva drag-and-drop.
- Ofrecer «Editar» para selección y arrastre, y «Probar» para navegación visual, tabs, acordeones y carruseles. Las acciones de compra/envío no deben ejecutarse desde el modo editor.

La primera entrega puede ser un panel o pestaña de preview completo. Debe identificarse como hito intermedio; el lienzo fiel sigue siendo parte obligatoria del plan.

## Orden de implementación

| Fase | Trabajo y entrega verificable | Dependencias |
| --- | --- | --- |
| 0. Contrato y baseline | Preparar fixtures con los mismos documentos y datos; capturas editor/web a 390/768/1440; identificar fuente distribuida; fijar semántica de guardar/publicar. Probar aislamiento CSS en 0.20.2. | Ninguna |
| 1. Fidelidad editorial en landings | Compartir vistas y estilos; contexto de tema; fuentes y tamaños reales; Hero overlay/split, bloques editoriales y FAQ seleccionables. | 0 |
| 2. Catálogo y preview completo | `ProductsList` real; estados vacío/error; sesión de preview del documento sin guardar; página completa con shell y datos correctos. | 1 y contrato de autorización |
| 3. Home y campañas | Reemplazar tarjetas representativas. Empezar por CampaignHero, productos y categorías; continuar banners, marcas, blog, combos, videos y looks. | Contexto, estilos y resolución de 1–2 |
| 4. Directorio | Compartir vistas de header/hero/listado/beneficios/footer; aplicar root colors y tiendas reales; preview transitorio que no guarde settings. | Base de preview y aislamiento |
| 5. Emails | Reutilizar el endpoint actual para actualizar preview con debounce; mostrar variables resueltas y datos de ejemplo; anchos desktop/mobile; conservar HTML seguro y renderer de envío. | Puede ejecutarse separadamente |
| 6. Distribución y cierre | Publicación versionada del plugin cuando se autorice implementar/release; dependency y lockfiles; manifests/payloads pertinentes; verificación en proyectos generados. | Funcionalidad y validación completas |

Primer corte recomendado: fases 0–2. Es suficientemente pequeño para validar el enfoque y resuelve tanto las landings estáticas como la principal fuente de abstracción dinámica. Home y Directorio deben reutilizar esa base, evitando tres soluciones divergentes.

## Mejoras de uso

- Etiquetas «Guardar cambios», «Ver cambios sin guardar» y «Ver publicada», con semántica real. Separar borrador y versión publicada requiere una decisión de persistencia; no resolverlo cambiando únicamente el texto del botón.
- Selector visual de imágenes existente como base para landings, recorte coherente y control del punto focal sólo si se implementa también en la web.
- Pickers con nombres, miniaturas y búsquedas de productos/categorías/colecciones, persistiendo referencias válidas. Mostrar el resultado del filtro al configurarlo.
- Renombrar la etiqueta de `ProductGrid` a una descripción honesta de su comportamiento, conservando el identificador serializado. Cualquier conversión a `ProductsList` debe ser explícita y preservar links/contenido.
- Agrupar campos por contenido, apariencia y fuente de datos. Ofrecer variantes que existan en el renderer, evitando un catálogo de controles visuales sin efecto real.
- Conservar selección, scroll e historial al aplicar cambios, incluso propuestas IA. Revisar los remounts por `puckKey`; no asumir que sólo cambiar el estado alcanza para sincronizar Puck.

## Criterios de aceptación

1. Mismo documento, tema, datos y ancho producen la misma estructura, fuentes, colores, saltos de línea, cantidad/orden de tarjetas y geometría en editor y web. Aceptar sólo diferencias de overlays de edición y antialiasing acordadas.
2. El usuario puede seleccionar, reordenar, duplicar, editar y deshacer sobre bloques reales. Probar modo interacción sin perder el documento.
3. Cambiar texto/imagen/filtro actualiza el preview sin guardar ni alterar el sitio público. Las respuestas viejas no pisan una revisión nueva.
4. Tema oscuro del Admin no cambia el contenido de la web. Cambiar de tienda no conserva datos, fuentes o colores de la anterior.
5. Datos vacíos, error de Typesense, imagen ausente, fuente lenta y bloque desconocido tienen estados útiles en el editor; no quedan esqueletos permanentes.
6. Comparación visual automatizada con fixtures estables y capturas después de cargar fuentes/imágenes. Probar también integración con datos reales de una tienda autorizada; las fixtures no prueban producción.
7. Cubrir supermercado, campaña y otro template visualmente distinto; landing global y por canal; URLs de tienda por ruta/subdominio y Admin editando una tienda distinta de la activa.
8. Cargar/guardar documentos existentes sin pérdida de props, IDs o bloques; aplicar generación IA y mantener contratos editor/IA/web sincronizados.
9. Generar perfiles con/sin landings, multistore y emails; ningún módulo opcional ausente rompe build o rutas ajenas.
10. Emails: comparar preview y HTML del mismo renderer con idénticos datos. No prometer equivalencia exacta entre clientes de correo sin pruebas específicas.

## Fuentes del análisis

Rutas relativas al repositorio:

- `packages/plugins/plugin-landing-pages/src/admin/lib/puck/config.tsx`: estilos propios, placeholders, campos y configuración de bloques.
- `packages/plugins/plugin-landing-pages/src/admin/lib/puck/creative-config.tsx`: representación editorial duplicada.
- `packages/plugins/plugin-landing-pages/src/admin/routes/landing-pages/[id]/page.tsx`: edición, guardado, IA y link público.
- `apps/storefront/src/modules/landing-page/components/{landing-renderer,landing-products-block,creative-blocks}.tsx`: salida real.
- `apps/storefront/src/lib/data/landing-pages.ts` y `apps/storefront/src/app/[countryCode]/(main)/l/[slug]/page.tsx`: lectura pública y caché.
- `packages/plugins/plugin-landing-pages/src/api/store/landing-pages/[slug]/route.ts` y `src/modules/landing-page/models/landing-page.ts`: publicación y documento persistido.
- `apps/backend/src/admin/lib/puck/home-config.tsx` y `apps/storefront/src/modules/home/components/home-renderer/index.tsx`: representaciones vs. secciones reales y reglas de merge.
- `apps/backend/src/admin/lib/puck/directory-config.tsx` y `apps/storefront/src/app/[countryCode]/(directory)/tiendas/sites-directory.tsx`: configuración y composición del directorio.
- `apps/backend/src/admin/routes/email-templates/[id]/page.tsx`, `src/admin/lib/puck/email-config.tsx`, `src/api/admin/email-templates/[id]/preview/route.ts` y `src/modules/email-template/render-email.ts`: canvas y HTML final.
- `apps/backend/medusa-config.ts`, `packages/plugins/plugin-landing-pages/{package,mercatto-plugin}.json`: plugin registrado, versión 1.0.1; backend declara `^1.0.1`. No se comprobó el bundle instalado/desplegado.
- `packages/contracts/storefront-shared`: precedente para primitivas portables con adaptadores. No equivale a tener ya una librería completa de bloques compartidos.

Fuentes oficiales de Puck: [código 0.20.2 de Puck](https://github.com/puckeditor/puck/blob/v0.20.2/packages/core/components/Puck/index.tsx), [AutoFrame 0.20.2](https://github.com/puckeditor/puck/blob/v0.20.2/packages/core/components/AutoFrame/index.tsx), [override del iframe](https://puckeditor.com/docs/api-reference/overrides/iframe), [API actual](https://puckeditor.com/docs/api-reference/components/puck). La API actual no debe asumirse disponible en 0.20.2.

Estado: **pendiente de implementación y validación visual**. Hallazgos basados en lectura de código; no son una auditoría visual de la instancia desplegada. No se ejecutaron builds ni tests por tratarse de un plan sin cambios funcionales.
