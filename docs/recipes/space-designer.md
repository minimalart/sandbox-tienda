# Diseñador de espacios

`@minimalart/mercatto-plugin-space-designer` agrega configuradores independientes al backoffice y al storefront. Un configurador publicado ofrece plantillas **ya equipadas**. Elegir una copia sus objetos, posiciones, terminaciones y equipamiento incluido; el comprador puede continuar directamente al carrito o personalizarla.

## Decisión y referencia

El prototipo `Configurador aula maker` de v0 carga muebles al confirmar el plano, pero usa cinco productos, precios y geometrías de Educabot fijos y un carrito simulado. Se conserva la selección por tarjetas, el ambiente 3D y el editor con catálogo, espacio y resumen. Sus modelos y texturas se adaptan a un renderizador configurable por producto: el motor no decide geometría, accesorios ni terminaciones según nombres de clientes o referencias comerciales.

El sistema tintométrico establece el precedente de capacidad opcional y visibilidad condicionada por configuración. Para esta funcionalidad, que tiene datos, rutas y administración propios, se usa el patrón de plugins Medusa del boilerplate. No depende del ERP ni de otros plugins.

Referencias: [IKEA Home Design](https://www.ikea.com/es/es/home-design/) y [desarrollo local de plugins Medusa](https://docs.medusajs.com/learn/fundamentals/plugins/create). El PDF proporcionado de Aula Maker se usa como referencia de contenido: además de mobiliario incluye kits, computación, hardware, plataformas y servicios.

## Datos

- `SpaceConfigurator`: título, slug, canal de venta, borrador/publicado y configuración versionada.
- `SpaceProduct`: referencia a producto y variante Medusa, categoría de presentación, medidas, asset 3D o imagen y rotaciones. No almacena un segundo precio ni catálogo comercial.
- `SpaceTemplate`: ambiente, objetos iniciales colocados, objetos fijos y productos incluidos con cantidad.
- `SpaceDesign`: una configuración guardada del comprador.

Las coordenadas `x/z` representan el centro del objeto, en metros. Cada objeto colocado equivale a una unidad. Los ítems incluidos tienen cantidad explícita y pueden definir medidas y representación 3D. Ambos se agrupan por variante para el carrito: distribuir visualmente los accesorios no crea unidades facturables adicionales.

`SpaceAsset` admite `kind: primitive | image | glb`, `model`, colores principal y secundario, montaje (`floor`, `surface`, `wall`, `ceiling`) y `anchor_product_ref`. El anclaje debe referir a otro producto ubicable del mismo configurador; permite repartir equipamiento incluido sobre ese mobiliario. Los modelos paramétricos disponibles son mesa, escritorio, conjunto hexagonal, estantería, armario, silla, computadora, proyector y kit de robótica. Un GLB propio conserva la posibilidad de incorporar otros productos sin reescribir el motor. El servidor valida URLs y referencias, sin descargar archivos externos.

El ambiente conserva `floor_texture_url` y `wall_texture_url`; cada opción de terminación admite `texture_url`. Estos campos se guardan también en diseños y forman parte de la comparación de plantillas fijas. Los assets deben estar disponibles desde el navegador; los alojados en un CDN necesitan CORS para texturas y GLB.

Una computadora, un proyector o un kit pueden configurarse como ubicables o como equipamiento incluido. La distinción corresponde a su representación en el diseñador, no a una clasificación comercial fija.

## Instalación local

La versión `1.0.0` está publicada en GitHub Packages y el backend la instala desde `@minimalart/mercatto-plugin-space-designer`. Para probar cambios locales antes de una nueva publicación, usá el flujo de Medusa/Yalc:

```powershell
pnpm --filter @minimalart/mercatto-plugin-space-designer build
Set-Location packages/plugins/plugin-space-designer
pnpm exec medusa plugin:publish
Set-Location ../../../apps/backend
pnpm exec medusa plugin:add @minimalart/mercatto-plugin-space-designer
pnpm exec medusa db:migrate
pnpm dev
```

El backend registra el plugin sólo cuando está instalado. `SPACE_DESIGNER_ENABLED=false` permite deshabilitarlo. Sin plugin o sin configuradores publicados, la navegación del diseñador no aparece. Antes de migrar, verificá que el backend usa la base del entorno de destino.

Para publicar una nueva versión, seguí `docs/PLAYBOOK-plugin-lifecycle.md`: incrementá la versión y el changelog, publicá el paquete, actualizá la dependencia y ambos lockfiles, y luego cambiá la versión de ambos catálogos.

## Configurar Educabot desde el backoffice

1. Abrí **Diseñador de espacios** y creá “Diseñá tu aula maker”, slug `aula-maker`, en el canal de Educabot.
2. Elegí productos y variantes existentes: estaciones o mesas, puesto docente y guardado como ubicables; computadoras, proyector y kits como incluidos, o ubicables si tienen una representación útil.
3. Indicá las medidas reales, elegí el modelo paramétrico o la URL de un GLB propio, colores y montaje. Para computadoras o kits sobre mesas, seleccioná montaje “Sobre un mueble” y el producto de anclaje. Configurá el proyector en el techo cuando corresponda. Las imágenes del catálogo ilustran los productos; su volumen en la escena se define con el modelo paramétrico o GLB. Sin un modelo, se muestra una geometría básica con las medidas declaradas.
4. Creá “Aula pequeña”, “Aula mediana” y “Aula grande”. Definí dimensiones y terminaciones, colocá los muebles y agregá cantidades del equipamiento incluido. Guardá cada distribución antes de publicar.
5. Publicá el configurador. En el storefront entrá a `/ar/espacios/aula-maker` (reemplazá `ar` por el país del sitio). Al elegir una plantilla se abre equipada en 3D y el resumen contiene todas las variantes y cantidades incluidas.

`packages/plugins/plugin-space-designer/examples/educabot.ts` ofrece las mismas tres distribuciones como configuración reutilizable. Requiere pasar IDs reales de productos y variantes; no crea productos ni inventa precios. Las cantidades y dimensiones son un ejemplo editorial y deben adaptarse a la oferta real antes de publicarlo. Todos los nombres Educabot permanecen en este ejemplo, fuera de la lógica del motor.

El ejemplo recibe opcionalmente `assetsBaseUrl` como cuarto argumento. Su valor predeterminado `/space-designer/examples` apunta a las texturas originales del prototipo copiadas a `apps/storefront/public/space-designer/examples`. Para alojarlas en otro sitio, cambiá esa base o las URLs desde el admin. Las superficies texturizadas usan blanco como color base para preservar sus colores originales.

El escritorio docente del ejemplo carga `models/teacher-desk.glb`, un asset de demostración generado a partir de la geometría paramétrica del prototipo. Es una aproximación visual; no es un modelo técnico del fabricante. `model: desk` queda como respaldo si el archivo no puede descargarse.

## Alcance de v1

Ambiente rectangular 3D con modelos paramétricos y GLB, manipulación y rotaciones permitidas, objetos fijos, texturas de piso y paredes, equipamiento incluido, cantidades, resumen y agregado conjunto al carrito normal. El admin conserva un plano superior para editar posiciones y ofrece campos para configurar las representaciones 3D. El servidor vuelve a validar configurador, canal, variantes y selección; Medusa resuelve los precios y el inventario. Compartir diseños y convertirlos en presupuestos quedan como evoluciones del modelo.

## Validación local con Medusa y PostgreSQL

Se verificó el paquete publicado localmente mediante Yalc en un consumidor separado, `apps/backend/.space-designer-smoke`, contra PostgreSQL 15 en Docker (`codex-space-designer-pg`, puerto local 5545, base `space_designer`). El consumidor sirve Medusa en `http://localhost:9001`; no carga el `.env` del backend principal. La migración `Migration20260904153000SpaceDesigner` y las migraciones nativas de Medusa finalizaron correctamente.

La fixture crea seis productos y variantes de prueba reales en Medusa, una región ARS, dos canales, claves públicas para cada canal y una clave multicanal. Usa las tres distribuciones del ejemplo Educabot y assets locales del prototipo. **Son datos y precios de QA, no un catálogo ni una implementación productiva de Educabot.** No se migró ni modificó una base remota.

La prueba HTTP verificó:

- Sólo aparece el configurador publicado; el borrador y el configurador de otro canal permanecen excluidos. Una clave multicanal exige elegir un canal autorizado.
- El backoffice busca productos reales, crea, modifica, relee y elimina configuradores persistidos; rechaza una variante que pertenece a otro producto.
- El agregado conjunto genera seis líneas con 13 unidades: dos estaciones, un puesto docente, un mueble de guardado, cuatro computadoras, un proyector y cuatro kits. Los precios nativos de la fixture suman ARS 4.240.000; un `unit_price` enviado por el cliente no reemplaza esos precios.
- Una selección inválida deja el carrito sin cambios. Una plantilla con `allow_custom: false` se agrega correctamente después de persistirla y recuperarla de JSONB, aunque PostgreSQL reordene las claves.
- Un cliente autenticado guarda y recupera su diseño; otro cliente recibe 404 y una visita anónima recibe 401. Al modificar el configurador, el diseño conservado mantiene sus referencias originales y devuelve `stale: true`.

En el navegador se verificó también la edición visual: mover, rotar, eliminar y agregar objetos, cambiar terminaciones y guardar el diseño. Desde el admin se cambió la cantidad de computadoras del aula pequeña de cuatro a cinco; el storefront mostró las 14 unidades correspondientes. Al reabrir el admin se confirmó la cantidad persistida y finalmente se restauraron cuatro computadoras. La fixture conserva esa configuración final y nombres legibles para los seis productos.

El diseño guardado se recuperó después de recargar, conservando el ancho personalizado de siete metros. El botón del diseñador abrió el carrito normal con las seis variantes, 13 unidades y ARS 4.240.000. En móvil (390 × 844) se comprobó la selección de otras predefinidas, la ausencia de desbordamiento horizontal y el desplazamiento automático al plano equipado. Pasaron la compilación del plugin (servidor y admin), TypeScript del storefront y las pruebas de contrato, selección y composición sin el plugin.

La demo del storefront queda en `http://localhost:3001/espacios/aula-maker`; el admin, en `http://localhost:9001/app/space-designer`. El entorno de QA no levanta Typesense y usa sus fallbacks habituales; las imágenes HTTP locales pueden mostrarse como placeholders en el carrito por la protección de imágenes de Next. Ninguna de esas condiciones modifica los productos ni las cantidades del diseñador.

Los artefactos temporales de esa verificación están disponibles en este workspace: `fixture.json`, `smoke-api.mjs`, `smoke-results.json`, `smoke-designs.mjs` y `smoke-designs-results.json` dentro del consumidor. Se ejecutaron con:

```powershell
# Desde apps/backend/.space-designer-smoke, con su base local configurada.
../node_modules/.bin/medusa.cmd db:migrate
../node_modules/.bin/medusa.cmd exec ./src/scripts/seed-space-smoke.ts
node ./update-fixture-3d.mjs
node ./smoke-api.mjs
node ./smoke-designs.mjs
```

La ampliación 3D pasó TypeScript del plugin, compilación del servidor y admin, y 14 pruebas de contrato de selección y ejemplo. Cubren referencias de anclaje inválidas, cantidades sin duplicación por representación 3D, URLs GLB, conservación de texturas y rechazo de terminaciones alteradas en plantillas fijas. `update-fixture-3d.mjs` relee las configuraciones publicadas y de borrador antes de actualizar los assets; luego confirma que conserva posiciones y cantidades. El resultado está en `smoke-3d-results.json`. Se repitieron las diez comprobaciones HTTP con esa configuración y el carrito mantuvo seis variantes, 13 unidades y ARS 4.240.000.

En la fixture 3D, las texturas y el GLB usan `http://localhost:3001/space-designer/examples/...`, el mismo origen del storefront. El servidor estático del consumidor en 9001 no aporta CORS para WebGL; no se amplió su política global para esta prueba.

La escena Three.js se verificó en el navegador del storefront de este checkout: las tres predefinidas abren completas (13, 18 y 23 unidades), cargan el escritorio GLB y colocan computadoras y kits sobre los puestos de las mesas. Se comprobaron cámara 3D/planta, zoom, pantalla completa en escritorio, selección, desplazamiento y rotación con teclado, eliminación y cambio a la textura STEAM azul. En móvil de 390 × 844, el canvas ocupa 345 × 500 sin desbordamiento horizontal. Pasaron TypeScript completo del storefront y 12 pruebas de contrato, diseño y escena, además de la prueba de composición con y sin el plugin. Los gestos con dos dedos se comprobaron con la implementación real de OrbitControls mediante eventos de prueba; esa comprobación no sustituye una prueba táctil en un dispositivo físico.

En el backoffice se verificaron visualmente las URLs de terminaciones, los nueve modelos paramétricos, colores secundarios, montaje y anclaje de computadoras a estaciones. Durante esta comprobación, Vite y el navegador conservaban un bundle antiguo del paquete Yalc con la misma URL inmutable. El consumidor local usa `admin.vite.cacheDir: node_modules/.vite-space-designer-3d` para servir el bundle actualizado desde otra ruta. Es un ajuste del entorno temporal de QA; no cambia la configuración del host ni del plugin publicado.

El entorno expuso dos condiciones previas del workspace. El admin necesita el mismo `admin.vite.resolve.dedupe` de React/React Query que ya configura el host. Además, los plugins antiguos aportan MikroORM 6.4.13 al árbol compartido, mientras Medusa 2.18 usa 6.6.14; una importación directa del módulo nativo de promociones resolvía la copia antigua y fallaba incluso en `POST /store/carts`, antes de intervenir Space Designer. Este plugin declara ahora peers y dependencias de desarrollo 6.6.14, alineados con el backend.

Para aislar esa mezcla durante el smoke se usó exclusivamente el resolver temporal `apps/backend/.space-designer-smoke/align-orm.cjs`, que hace resolver `@mikro-orm/core`, `knex`, `postgresql` y `migrations` a la copia 6.6.14 del host. No modifica promociones, precios, inventario ni workflows; tampoco forma parte del plugin distribuido. El comando del servidor de QA fue:

```powershell
# Desde apps/backend/.space-designer-smoke.
$env:NODE_OPTIONS = '--require=' + (Join-Path (Get-Location).Path 'align-orm.cjs')
../node_modules/.bin/medusa.cmd develop --port 9001
```

El smoke acredita la integración funcional en ese entorno alineado. No acredita que el árbol compartido de plugins anteriores esté libre del conflicto de versiones; esa alineación general queda fuera del alcance de Space Designer.
