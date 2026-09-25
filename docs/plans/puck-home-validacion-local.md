# Home en Puck: implementación y validación local

## Para revisar

Admin local: `http://localhost:9001`. Storefront local: `http://localhost:3000`.

- Supermercado: <http://localhost:9001/app/sites/demo_01M38DHXVX04ZQ1BMQ23KNFMQ7/home>
- Campaña: <http://localhost:9001/app/sites/demo_01M38DHXZWHYQYNH6M1X21HZSB/home>
- Tecnología: <http://localhost:9001/app/sites/demo_01M38DHY1FD614CD4BXCK3MKCX/home>
- Moda: <http://localhost:9001/app/sites/demo_01M38DHY36D93T8T05NHS3AY40/home>
- Tecnología retail: <http://localhost:9001/app/sites/demo_01M38DHY4Q703VSHGHS39TABY9/home>
- Deportes: <http://localhost:9001/app/sites/demo_01M38DHY6EC16E0EP4J926PPKF/home>

La base `mercatto_puck_visual`, el índice `puck_local_products` y las tiendas son fixtures locales. El backend mínimo monta el módulo real de tiendas, el editor real y las rutas reales de snapshots; adapta las rutas de lectura/guardado y configuración para funcionar sin el resto de las extensiones. El banner de supermercado es una respuesta de prueba. Los productos de campaña tienen imágenes locales reutilizadas, no representan un catálogo comercial. No hubo deploy ni publicación.

## Cambios

- Home utiliza el renderer del storefront por bloque, con el tema, canal, región y banners de la tienda editada. Los campos de supermercado y campaña conservan su edición en Puck.
- Vista completa de cambios sin guardar con encabezado y pie reales; tamaños 390/768/1440 y tres íconos distintos.
- Snapshots inmutables de diez minutos, ligados al ID de la tienda de la ruta. Se rechazan otra tienda, país fuera de su región, origen no permitido y bloques desconocidos. Ver una Home no guarda su documento.
- Las vistas se inicializan en serie para evitar fallos de caché al hidratar muchos iframes simultáneos con bundles de desarrollo. Los bloques sin contenido se identifican en el editor.
- Los layouts iniciales heredan contenido configurado en vez de introducir los textos de ejemplo de nuevos bloques. Supermercado distingue la composición principal de la composición de otras tiendas.
- Tecnología, moda, tecnología retail y deportes exponen sus secciones nativas como bloques ordenables y eliminables. El contenido de esas secciones sigue viniendo de la configuración de la tienda; esta fase no agrega campos Puck para cada contenido interno. Los IDs de sección son persistidos: no renumerarlos al incorporar nuevas secciones.
- Las búsquedas de producto de la vista previa no registran analítica. El puente compartido evita navegación, compras y envío de formularios dentro del preview.

## Evidencia

- Campaña: edición de título reflejada en bloque y página completa; documento guardado aún `null`. Tres productos propios, imágenes cargadas, encabezado y pie presentes. 390/768/1440 sin desbordamiento horizontal.
- Supermercado: banner de su canal, categorías, destacados, combos, novedades y más categorías. Página completa en 390/768/1440 sin desbordamiento; contiene productos de supermercado y no los de campaña; documento guardado aún `null`.
- Las otras cuatro plantillas: snapshots de sus composiciones completas renderizados a 1440 con encabezado, pie y secciones correspondientes; sin pantalla de error. Sus fixtures no tienen productos, por lo que las filas de catálogo quedan vacías.
- Cinco pruebas automatizadas pasan: token/expiración/inmutabilidad, origen, tamaño máximo, ruta real con aislamiento de tienda/región y ausencia de guardado, paridad de UI compartida entre host y plugin.
- Build del plugin de landings y su bundle de Admin correctos después de generalizar el transporte compartido.
- Chequeos de tipos focalizados sin errores en los archivos Home/preview modificados. No se declara el chequeo global limpio: persisten errores de tipos ajenos en hooks del Admin, email y timers de componentes existentes; el chequeo general del storefront también encontró un archivo generado `.next/dev/types/routes.d.ts` inválido durante desarrollo.
- Payload de los archivos modificados/nuevos de multistore sincronizado. `verify-components.js multistore` reporta únicamente un desajuste ajeno en `modules/demo-store/templates/main-config.test.ts`; no se sobrescribió ese trabajo.

Capturas en `output/playwright/puck-home-*`. El entorno mínimo emite avisos por endpoints opcionales no montados (por ejemplo tintometría/promociones). La validación del usuario sigue pendiente antes de cualquier deploy.
