# Checkout configurable por tienda

La configuración está en **Tiendas → Editar tienda → Checkout**. Su botón **Guardar checkout** guarda independientemente del resto del formulario. La API usa revisión de política para rechazar una edición administrativa desactualizada. El guardado general conserva el checkout vigente en base de datos.

## Contrato y alcance

`demo_store.content_config.checkout` contiene preferencias para contacto, dirección, entrega, facturación, pago y revisión, además de destinatarios (apagados por defecto, todos los productos o IDs de productos de esa tienda). Los textos son configurables y el documento admitido es DNI argentino de 7 u 8 dígitos. Las preferencias recuperan información requerida; no desactivan stock, elegibilidad de envío, requisitos fiscales, crédito ni la validación de Medusa. La interacción del proveedor sigue visible para importes positivos.

Las rutas activas B2C y B2B consumen el flujo efectivo calculado por servidor. En carritos digitales se omiten domicilio y entrega. Un retiro se verifica contra opciones y sucursales de la tienda. Solo se resuelve automáticamente una alternativa única compatible con todos los perfiles físicos. No se elige por precio ni por orden del listado.

Cada unidad tiene un UUID estable y una referencia opaca de línea. Las personas se reutilizan globalmente, por producto o por unidad. La reducción de cantidades con personas diferentes exige seleccionar qué unidades conservar. DNI repetidos con nombres incompatibles se rechazan. Cambiar a asignación global exige confirmación cuando reemplaza personas diferentes.

## Persistencia y acceso

Ejecutar `Migration20260908180000` mediante las migraciones habituales de Medusa **antes** de servir este código. Agrega tablas privadas para contexto de carrito, sesión, snapshot inmutable y auditoría de lectura de documentos. No hay DNI en metadata de carrito/pedido. La metadata de línea solo lleva `checkout_line_key`, que Medusa copia al pedido y se usa para vincular unidades sin depender del orden de arrays o del SKU.

El storefront necesita la credencial administrativa de servidor ya existente `MEDUSA_ADMIN_API_KEY` para vincular el carrito a su tienda y modo B2C/B2B mediante `/admin/sites/checkout-context`. La credencial nunca llega al navegador. La ruta intermediaria toma el carrito de las cookies de sesión, no del body. El contexto se fija una vez; compartir canal no permite cambiar la tienda de origen. Una cookie httpOnly privada aporta la capacidad de acceso al checkout, combinada con canal publicable y autenticación del comprador cuando corresponde. Los logs de depuración del SDK están desactivados para no imprimir esta cabecera.

La política se fija al iniciar el checkout. Guardar personas exige revisión vigente. Antes de crear sesiones de pago se guarda un snapshot inmutable; la validación central de `completeCartWorkflow` exige cobertura, entrega y correspondencia de importe/moneda. Las mutaciones de carrito y la finalización se coordinan con una reserva temporal en PostgreSQL. Los pagos pendientes se cancelan antes de invalidar datos; pagos autorizados o en confirmación impiden editar. La exención de renovaciones exige un ciclo real del módulo de suscripciones, no un flag de metadata.

El widget de pedido muestra documentos enmascarados. Un usuario administrativo puede limitarse a tiendas mediante `metadata.checkout_site_ids`. Para revelar DNI debe tener la tienda en `metadata.checkout_document_site_ids`; la lectura queda auditada. Estos permisos requieren provisión administrativa: esta entrega no agrega un editor de roles.

## Retención y recuperación

El job horario limpia sesiones abandonadas vencidas, después de cancelar pagos pendientes. Conserva pedidos y evidencia de pagos en proceso; ante fallas reintenta. La duración de sesiones nuevas es configurable entre 1 y 90 días. Los errores no incluyen documentos ni consultas SQL. El borrado de una tienda con sesiones/histórico protegido se rechaza.

Para revertir, restaurar preferencias para compras nuevas y conservar tablas, rutas de lectura y validación de políticas activas. No eliminar el módulo ni sus datos mientras existan compras dependientes. El catálogo actual marca Multistore obligatorio; no hay una desinstalación soportada por el generador normal. El borrado manual del código no está protegido por una migración de salida.

## Validación del 2026-09-08

Fuente: working tree sobre `921211b9bd081c412fa9ae8060f9cf1bab91cf21`, con cambios previos ajenos preservados. Medusa instalado 2.18.0, Next.js 16.2.9. No se desplegó ni se aplicaron migraciones a entornos reales.

| Prueba | Estado y alcance |
| --- | --- |
| Resolver, defaults, apagado/ausencia, digital/retiro, DNI, cobertura, cantidades, fusión y mapping | PASÓ: 12 tests de funciones |
| Migración, políticas independientes, contexto compartido, dos escritores, reservas y snapshots | PASÓ: 1 integración con PostgreSQL 16 real y adaptadores de carrito/proveedor sintéticos |
| TypeScript backend y storefront | PASÓ; backend no incluye el admin en su tsconfig |
| Drawer real Editar tienda y destinatarios | PASÓ en navegador con fixture local; componentes reales, API simulada. Guardado, validación de DNI, dos unidades/personas y confirmación de sustitución |
| Distribución Multistore y B2B | Payloads sincronizados y verificados contra fuente |
| Generación estándar | PASÓ; el catálogo incluye Multistore aun con `extensions: []` |
| Composición sin módulo | PASÓ generación y poda de rutas, módulo y hook al excluir solo Multistore en memoria; consumidor del storefront conservado. No modifica el catálogo real |
| Pasarelas y creación completa de pedido | NO EJECUTADO contra proveedores; la prueba SQL no ejecuta el workflow completo de Medusa |
| Crédito, gift card total/parcial, total cero, aprobación B2B, callbacks/rechazos | PENDIENTE de aceptación integral en entorno de prueba |
| Build con Multistore | PASÓ `next build --webpack` en snapshot generado, reutilizando dependencias instaladas (junctions); no es instalación limpia. Backend sintético no disponible, prerender con fallbacks |
| Build sin Multistore | Compilación webpack PASÓ en composición aislada; dependencias reutilizadas y backend sintético sin servicio. No acredita checkout funcional contra Medusa |
| Perfil con todas las extensiones eliminadas | FALLÓ build por imports existentes de Mercado Pago y Typesense; no es el perfil aislado sin Multistore |
| Arranque del proyecto generado | NO EJECUTADO: revisión automática bloqueó `next start` en 127.0.0.1:45439 sin motivo adicional |

La aceptación completa del PRD y la propagación a producción quedan pendientes de los recorridos integrales indicados. No usar las pruebas de componentes o SQL como prueba de cobros, callbacks o del histórico en un pedido real.

## Suite ampliada de regresión (2026-09-08)

Se ejecutaron **209 pruebas: 179 unitarias y 30 pruebas/subpruebas de integración**, todas aprobadas, sin omisiones. La integración usa PostgreSQL 16 real y adaptadores sintéticos de carrito y proveedor; no ejecuta cobros reales.

- `acceptance-matrix.test.ts`: las 64 combinaciones de visibilidad contra escenarios digital, físico/mixto, retiro verificado, elección de sucursal pendiente, contacto faltante, factura A, destinatarios incompletos y total cero; también entradas inválidas, aislamiento de objetos, DNI, identidad estable, referencias ajenas y cambios que invalidan snapshots.
- `logistics.test.ts`: stock insuficiente, opciones eliminadas, importes de envío desactualizados, cobertura de múltiples perfiles, ítems digitales, retiro verificado y selección pendiente de sucursal.
- `payment.test.ts`: importe inválido, saldo neto tras créditos, total cero/parcial, estados procesables, históricos rechazados y múltiples sesiones activas.
- `http.test.ts`: autenticación, permisos de tienda y documentos, selección de otra tienda, permisos malformados y errores sin datos privados.
- `runtime.integration.test.ts`: persistencia, revisiones simultáneas, ocho preparaciones concurrentes, bloqueo de mutaciones, contexto de tiendas con canal compartido, estados y montos/monedas de pago, caída durante cancelación, vencimiento, pedidos completados e intento de omisión por metadata de renovación. El job de retención se ejecuta contra PostgreSQL para comprobar limpieza, histórico, confirmaciones en curso y fallas de cancelación.
- `checkout.test.ts`: regresiones iniciales de políticas, asignación, fusión de líneas y proyecciones reales de Medusa.

Las pruebas detectaron y motivaron tres correcciones: clonar los IDs de producto al resolver una política; exigir una lista real para permisos de documentos; rechazar múltiples sesiones procesables en el flujo de un solo proveedor. Una sesión válida ya no encubre otra activa con importe distinto.

Comandos desde `apps/backend`:

```sh
pnpm test:checkout
# Requiere CHECKOUT_TEST_DATABASE_URL apuntando a PostgreSQL desechable:
pnpm test:checkout:integration
# Incluye cobertura de los archivos de checkout:
node scripts/test-checkout.mjs --integration --coverage
```

El comando de integración falla inmediatamente si falta la URL: no permite confundir pruebas omitidas con pruebas aprobadas. Cada ejecución crea y elimina su propio esquema aleatorio. El workflow `Quality` incluye PostgreSQL 16 y la ejecución explícita de integración; la modificación del workflow se validó localmente, no se ejecutó GitHub Actions en esta tarea. No se modificaron protecciones de ramas.

Esto no reemplaza la aceptación integral pendiente de logística/proveedores reales, callbacks, stock, aprobación B2B, gift cards y creación efectiva del pedido. La matriz prueba los contratos de esta capacidad; no acredita que todas las integraciones externas sean infalibles.

Medición de cobertura sobre 205 pruebas (antes de sumar las últimas cuatro de retención): `policy.ts` y `payment.ts`, 100% de líneas y ramas; `assignments.ts`, 100% de líneas y 91,76% de ramas. Total de los cinco archivos instrumentados: 91,13% de líneas y 76,15% de ramas. Estos porcentajes no incluyen toda la aplicación, middleware HTTP ni SDKs/proveedores externos. La ejecución final de 209 pruebas pasó sin omisiones.

## Preparación para PR sobre main

La rama aislada codex/checkout-tested-release parte de 5707aa107. Conserva la implementación vigente de sesiones ya integrada en main y excluye los cambios locales de importación comercial de catálogo. La migración usa el nombre Migration20260908180000DemoStore conforme al contrato del repositorio.

Se repitieron 209 pruebas de checkout sobre esta base, 279 pruebas del storefront y 29 controles de documentación/aislamiento; todas pasaron. TypeScript de backend y storefront pasó reutilizando dependencias locales. Los dos bundles administrativos de checkout compilaron con esbuild. La suite general detectó una expectativa de capabilities de Odoo desactualizada y una ruta de lookups ERP sin registro; se actualizaron para reflejar el contrato actual de main. No se elevó ningún límite de deuda.

El merge permanece condicionado a cerrar las pruebas generales y la aceptación integral de compra en sandbox. No hay autorización para afirmar cobros, callbacks o creación completa de pedidos como verificados con los adaptadores sintéticos.

Build del storefront sobre la rama de preparación: FALLÓ por el import de server-only/next/headers desde @minimalart/mercatto-plugin-storefront-recommendations/slots hacia recommendations-cart-slot.tsx (client). Es código previo de main; no se modificó ni publicó ese plugin en esta entrega. Las 7 pruebas del composer pasaron. La dependencia local compartida del runtime se corrigió en el worktree; las 2 pruebas de configuración de plugins y las 3 de versiones pasaron.

Resultado final de la suite general del backend: 3862 pruebas registradas, 3861 aprobadas, 0 fallas y 1 evaluación de IA optativa omitida (RUN_AI_EVALS). Incluye integración PostgreSQL del checkout. Log local: tmp/backend-tests-verified.log. Storefront: 279 aprobadas; composer: 7 aprobadas. Backend y storefront TypeScript aprobados. No se hizo commit, PR ni merge porque el build sigue fallando y falta la aceptación integral en sandbox.
