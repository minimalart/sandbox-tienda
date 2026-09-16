# Validación de tiendas por subdominio — 10 de septiembre de 2026

Estado: **PENDIENTE DE VALIDACIÓN de integración y producción**. La implementación local está preparada; este informe no acredita un despliegue ni la infraestructura de un cliente.

## Alcance implementado

- Principal en su dominio; hub en el apex del sufijo; tiendas con subdominio derivado del slug.
- Backoffice con disponibilidad de subdominio, URL visible antes de guardar y persistencia de la forma canónica. Rechazo de duplicados, incluida la restricción de unicidad de la base.
- URLs en runtime para listado, detalle, editores, SEO, controles de acceso y retornos de Mercado Pago. El destino del pago se contrasta con las direcciones de la tienda registrada; el webhook sigue en el backend.
- Índice público con proyección limitada y paginación del backend; robots, sitemap y llms por host. Diferenciación entre listado vacío y error de carga.
- Tiendas no encontradas no heredan el tenant ni el canal principal. El nombre visible se puede editar; el slug conserva su contrato inmutable.
- Sin sufijo se conserva la forma por ruta. Los dominios del cliente se documentan como configuración y fixtures, sin condiciones comerciales por identidad.

## Evidencia ejecutada

| Control | Resultado |
| --- | --- |
| Suite completa del storefront (`node --experimental-transform-types --import ./test-register.mjs --test --test-concurrency=2 "src/**/*.test.ts"`) | 284 pruebas aprobadas |
| Selección backend: URLs, retorno de pago, proyección pública, configuración, controles de acceso y registro admin | 82 pruebas aprobadas |
| Resolución backend por container y SQL | 16 pruebas aprobadas en la selección inicial; conserva paridad y aislamiento |
| `typecheck` normal de backend y storefront | Ejecuciones aprobadas; el chequeo normal del backend excluye el admin |
| Verificación de payloads de multistore, store-config, mercadopago y seo-geo | Cuatro extensiones verificadas contra los fuentes |
| Catálogo y espejo backend | Sincronizados y validados |
| Proyectos generados mínimo y con store-config/seo-geo/mercadopago | Presencia de archivos de alta, índice y contrato de dominios comprobada; generación sin instalación ni arranque |
| Navegador local en `/tiendas`, escritorio y móvil | Pantalla y estado vacío renderizados; sin colegio publicado en esa prueba |
| Tienda inexistente local `/tienda/colegio-inexistente-qa` | HTTP 404 en el segundo intento, con la ruta compilada |

## Límites y pendientes

- El chequeo ampliado de tipos del admin encuentra errores fuera de la lógica nueva de dominios: exports de hooks, `DemoContentConfig.campaign`, tipos de theme y JSX. No se informa como aprobado; no se encontraron errores de sintaxis TS1xxx en esa ejecución.
- El control global de rutas store detectó `store/b2b/carts/[id]/presentations` sin registrar, ajena a este cambio. Las rutas nuevas de dominios sí quedaron declaradas. La suite global del backend no se informa como aprobada.
- El primer pedido HTTP local de una tienda inexistente agotó el tiempo de espera; el segundo respondió 404. Falta repetir la aceptación sobre el subdominio público con DNS y TLS habilitados.
- No se ejecutó alta completa desde el backoffice, importación de un colegio ni compra con proveedor real. Las pruebas de URL y retorno usan fixtures sintéticos.
- No se ejecutó build de producción ni se desplegó en Educabot. DNS, TLS, CORS, cachés por host y compra de punta a punta requieren validación en el entorno habilitado.
- Multistore es obligatorio en el catálogo actual; se probó el proyecto mínimo soportado, no una composición artificial que quite esa extensión.

Para habilitar los dominios y ejecutar la aceptación completa, seguir [el runbook](tiendas-por-subdominio.md).
