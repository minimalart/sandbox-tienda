# Importación de catálogos y presentaciones

Implementación de MERCATTO-1. La capacidad es reutilizable: no configura un cliente, un origen real ni una demo.

## Instalación y activación

La capacidad está incluida en **Tiendas** (`multistore`); no requiere una extensión adicional.
Los blueprints anteriores que seleccionan `store-importer` se resuelven como `multistore`.
El nombre del módulo y las tablas existentes se conservan para preservar conexiones e historial.
`Migration20260909170000CatalogSettings` copia el umbral guardado de importaciones
a Tiendas sin borrar el original ni reemplazar un valor ya configurado en Tiendas. Su módulo `catalog_import`
se registra mediante el mecanismo de módulos opcionales existente. Aplicar las
migraciones con `pnpm --dir apps/backend exec medusa db:migrate` en la instalación
que se vaya a actualizar, después de revisar el plan de despliegue. La migración
`Migration20260907210000StoreImporter` agrega conexiones, ejecuciones y relaciones de identidad;
no modifica productos existentes ni inicia importaciones.

En el admin, abrir **Tiendas → Editar → Catálogo**, configurar el origen y revisar
la muestra antes de confirmar. El destino es la tienda editada, incluida Main;
no depende del selector global. Alta y edición comparten los campos de origen. Las conexiones nuevas nacen desactivadas. Sin registro de sitios se
usa el canal predeterminado de la tienda Medusa; el destino nunca viene del body
del navegador. Las rutas requieren un usuario administrador existente según el
modelo de permisos actual del proyecto.

Ejemplo sintético del cuerpo de `POST /admin/catalog-imports`:

```json
{
  "name": "Catálogo de prueba",
  "enabled": false,
  "config": {
    "provider": "vtex",
    "sourceUrl": "https://catalogo.example/",
    "currencyCode": "ars",
    "searchStrategy": "auto",
    "inventoryMode": "ignore",
    "purchasePolicy": { "enabled": false },
    "fieldMapping": {},
    "protectedFields": []
  }
}
```

El dominio de ejemplo no es un proveedor operativo. Configurar la moneda, seller
y canal comercial del origen explícitamente cuando se conozcan. `priceTaxIncluded`
es opcional; sin tratamiento impositivo confirmado no se presenta la lista
importada como descuento. Cambiar origen, proveedor, moneda, seller o canal fuente
requiere otra conexión para no mezclar identidades ni ofertas.

El preview recupera como máximo cinco productos y no escribe catálogo. Muestra
estrategia, precios, presentaciones, acción de creación/actualización y campos
protegidos. La ejecución exige el digest de la configuración revisada. Los jobs
se procesan por el worker programado cada minuto; deben estar habilitados los
jobs de Medusa en el entorno de ejecución.

## Decisiones de datos

- El contrato neutral vive en `apps/backend/src/lib/catalog`. El servicio de
  importación no requiere `demo_store`, B2B ni Typesense. Los adaptadores anteriores
  conservan entradas compatibles para los flujos de demo existentes.
- La identidad usa destino, conexión e ID externo de producto/SKU. Se conservan
  IDs Medusa y relaciones en reimportaciones. No hay fusión por nombre, EAN o SKU
  compartido. Los productos históricos sin identidad suficiente se advierten;
  no se enlazan automáticamente y no se incluye un backfill heurístico.
- Sólo el precio actual entra en los precios de venta de Medusa. La lista,
  moneda, oferta, fecha y valores originales quedan en `catalog_commercial` por
  variante; no se crea una lista promocional. VTEX aplica `Math.round` una vez,
  sin multiplicar por cien. Otros proveedores conservan su normalización previa.
- La referencia tachada requiere lista mayor al precio efectivo, moneda igual
  y tratamiento impositivo conocido e igual. La lista está expresada en la misma
  unidad comprable del SKU. Los precios por grupo y por cantidad siguen a cargo
  del motor de precios existente.
- Se preservan variantes ausentes en una respuesta parcial, otras monedas,
  escalas de precio y asociaciones ajenas. Categorías e imágenes se reutilizan.
  La marca se enlaza cuando existe el módulo; también se conserva como metadato.
- Las protecciones de conexión, producto y variante impiden reemplazar los
  campos correspondientes. El widget del producto permite corregir lista,
  presentación y política, protegerlos y restaurar explícitamente el origen.

## VTEX y errores de origen

`auto` intenta Intelligent Search y utiliza legacy sólo ante interfaz no soportada
o esquema incompatible. Con `sourceChannel` explícito usa
`/api/intelligent-search/v1/product-search/` y `sc`; sin canal utiliza
`/api/io/_v/api/intelligent-search/product_search/`. Legacy utiliza
`/api/catalog_system/pub/products/search`. Esta distinción evita depender de una
cookie de segmento para seleccionar el canal. Referencia:
[contrato V1 de VTEX](https://developers.vtex.com/updates/release-notes/2026-07-08-new-intelligent-search-api-v1).

401/403 detienen el acceso. 429 y errores 5xx tienen reintentos acotados y respetan
`Retry-After`; no disparan una sustitución silenciosa de contexto. Hay límite de
tiempo, tamaño, solicitudes y páginas. Páginas repetidas, límites alcanzados o
fallos posteriores se reportan como recuperación parcial. Legacy alcanza como
máximo 2.500 productos e Intelligent Search 50.000 en esta entrega. WooCommerce y
Shopify conservan sus adaptadores, pero reportan completitud no demostrada.

Sólo se permiten orígenes HTTPS públicos sin credenciales. Se valida DNS, se fija
la IP pública para la conexión y no se siguen redirecciones; se rechazan direcciones
privadas, locales y reservadas. No se implementa scraping autenticado.

## Presentaciones y compra

La medida física y el contenido de un bulto son datos independientes: 0,75 litros
no representa una equivalencia fraccionaria de envases. No se infiere la política
de compra desde el título ni desde una descripción de empaque.

| Modo | Ejemplo | Cantidad canónica y precio |
| --- | --- | --- |
| Informativo | Etiqueta sin equivalencia confirmada | Compra normal del SKU; sin conversión |
| Agrupación | 2 bultos de 12 unidades a 100 | 24 unidades; 2.400 antes de escalas |
| SKU propio | 2 cajas con precio propio de 1.000 | 2 cajas; 2.000, sin multiplicar otra vez |

Para agrupación configurar `presentation.mode: "grouping"`,
`unitsPerPackage: 12`, `priceBasis: "unit"` y una política habilitada con
`allowedModes: ["unit", "package"]`. Para caja con SKU propio usar
`mode: "own-sku"` y `priceBasis: "sku"`. Son ejemplos, no defaults.
La equivalencia también puede venir de una propiedad estructurada elegida mediante
`fieldMapping.unitsPerPackage`. Mínimo y múltiplo son reglas separadas.

La PDP B2B (`/b2b/productos/[id]`) y el pedido rápido envían modo y cantidad al
servidor. Los hooks de creación, agregado, actualización, transferencia de cliente
y checkout validan la cantidad canónica; la fusión de líneas considera la cantidad
ya almacenada. No se redondean cantidades inválidas. Las escalas se evalúan sobre
24 unidades, no sobre dos bultos. El total previo al carrito se etiqueta estimado;
el carrito resuelve las condiciones comerciales efectivas.

Cada línea por presentación conserva un snapshot legible que llega al pedido.
Si cambia la equivalencia de un carrito existente, se rechaza y se solicita revisar
la línea. Desactivar la conexión impide nuevas conversiones, conserva cantidades
canónicas y mantiene la lectura de pedidos históricos. B2C conserva su selector
habitual y puede mostrar la medida o etiqueta sin incorporar controles mayoristas.

## Inventario, recuperación y actualización de derivados

Se entregan `ignore` y `availability-only`. Ambos conservan la observación de
disponibilidad; desconocido no se persiste como cero. No se crean niveles de stock,
no se activan cantidades administradas ni se sobrescribe `manage_inventory` de
variantes existentes. `managed` queda pendiente, como permite el PRD: requiere
contrato de cantidad, ubicación y reservas antes de habilitarlo.

La base impide dos jobs activos de una conexión/destino y el worker mantiene un
bloqueo por destino. Se guardan la entrada recuperada y un checkpoint por producto.
Reintentar reutiliza esa entrada y conserva IDs; para volver a consultar una fuente
que respondió parcialmente se inicia otra ejecución desde un nuevo preview.
Cancelar conserva lo ya confirmado. Una falla no vacía catálogo ni índice.

La salida pendiente de indexación contiene sólo IDs persistidos. Si falla emitir
`product.updated`, se reintenta desde esa salida sin reimportar. La entrega final
del índice depende del suscriptor y sus reintentos; no se probó un servidor
Typesense real en esta validación.

Fuente canónica y payloads se actualizan juntos. Versiones: `store-importer` 1.1.0, `b2b` 1.23.0, `multistore` 1.8.1 y `typesense` 1.4.1. Los adaptadores
de lectura compartidos por B2C quedan en el núcleo, para permitir composiciones sin
B2B/corporate. El composer excluye `tmp` de la copia de proyectos.

Un derivado existente debe aplicar expresamente su actualización por el mecanismo
de composición/actualización del proyecto, revisar conflictos y migraciones y
preservar sus settings y contenido. Estos cambios locales no publican paquetes ni
actualizan forks. Antes de activar, probar una conexión pequeña en una instalación
temporal. Para recuperar, detener nuevas ejecuciones y conservar checkpoints;
revertir código no restaura precios ya importados. No hay rollback automático de
datos comerciales ni borrado masivo por ausencia en origen.

## Validación de la entrega

La prueba de integración permanente es `apps/backend/src/scripts/test-catalog-import-fixture.ts`.
El runner `apps/backend/scripts/test-catalog-import.mjs` crea una instalación Medusa
temporal con el módulo nuevo y aplica las migraciones. Exige una base local llamada
`catalog_fixture` mediante `CATALOG_TEST_DATABASE_URL`; nunca utiliza el catálogo
real. La CI ejecuta este runner con PostgreSQL 16.

La prueba cubre persistencia y reimportación con IDs estables, precios y campos
protegidos, preservación de SKU ausentes, aislamiento de conexiones, concurrencia,
cancelación, previsualización y cantidades canónicas en carrito y pedido.
Los tests del adaptador usan fuentes sintéticas; no acreditan acceso al catálogo
de un proveedor real. La configuración y validación de Vital se hacen en su propia
instalación, después de incorporar esta versión.

Las validaciones del carrito se registran mediante el contrato compartido del
runtime para convivir con gift cards y checkout. La regresión de arranque carga
los tres hooks reales en un único proceso.
