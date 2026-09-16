# Tienda principal y tiendas por subdominio

## Contrato

Una instalación sirve la principal en su dominio, las secundarias en un wildcard y un índice en la raíz del dominio de tiendas. Los dominios son configuración de la instalación; no se incorporan nombres de clientes al código compartido.

| Caso de configuración | URL |
| --- | --- |
| Principal | `https://tiendas.educabot.com` |
| Colegio | `https://nombrecole.educabot.shop` |
| Índice público | `https://educabot.shop` |

Todas las nuevas tiendas usan `canonical_form=host` por defecto. Las existentes conservan su elección. La forma por ruta continúa disponible en `/tienda/<slug>` y canonicaliza al dominio del hub cuando se elige `path`. No hay redirección entre formas; la alternativa lleva canonical/noindex. El alias `www` del hub redirige al apex.

## Infraestructura: una sola vez

1. Registrar en el mismo proyecto del storefront el dominio principal, el apex del hub, su `www` y `*.<hub>`.
2. Configurar DNS y verificar el certificado wildcard antes de anunciar tiendas. El camino estándar de Vercel usa sus nameservers. Antes de cambiar una delegación, inventariar NS/MX/TXT y preservar correo, SPF, DKIM y DMARC. Seguir la documentación vigente del proveedor: https://vercel.com/docs/domains/working-with-domains.
3. Configurar el storefront:

```dotenv
NEXT_PUBLIC_BASE_URL=https://tiendas.educabot.com
NEXT_PUBLIC_PRIMARY_HOST=tiendas.educabot.com
NEXT_PUBLIC_SITE_HOST_SUFFIX=.educabot.shop
```

El hub se deriva del sufijo y del protocolo/puerto de la base. No requiere otra variable. En local, `http://localhost:3000` y `.localhost` permiten probar el hub y `http://colegio.localhost:3000`.

4. Configurar la base pública del backend y ampliar `STORE_CORS` y `AUTH_CORS` con orígenes completos o expresiones regulares ancladas en el formato aceptado por Medusa. Ejemplos conceptuales: `^https://tiendas\.educabot\.com$`, `^https://(www\.)?educabot\.shop$`, `^https://[a-z0-9-]+\.educabot\.shop$`. No eliminar los orígenes existentes necesarios ni incluir comodines abiertos. La URL del webhook de pagos sigue siendo la del backend.
5. En Ajustes → Multitienda, configurar `MULTISTORE_PUBLIC_BASE_URL=https://tiendas.educabot.com` y `MULTISTORE_SITE_HOST_SUFFIX=.educabot.shop`. Estos valores también admiten entorno. Deben coincidir con el deployment del storefront. Editarlos corrige las URLs del backend; no configura DNS, TLS ni modifica las variables compiladas de Next.

Esta preparación no se repite al crear cada colegio. No hace falta un token de Vercel o del proveedor DNS en el backoffice.

## Operación autónoma

1. Ir a Tiendas → Crear e ingresar nombre y subdominio.
2. Revisar disponibilidad y URL completa. Se rechazan nombres reservados, caracteres inválidos y duplicados. La base de datos impone unicidad también ante altas simultáneas.
3. Elegir plantilla, identidad visual y origen de catálogo, incluyendo canal existente cuando corresponda.
4. Guardar. La tienda pasa por preparación/importación y se publica al llegar a `ready` con un canal de venta válido.
5. Abrir el enlace del listado. Las tiendas publicadas aparecen en el índice. El nombre visible se puede editar; el subdominio es inmutable.

Un subdominio inexistente o una tienda no publicada no debe mostrar el catálogo de la principal. Las sesiones y carritos conservan aislamiento por tienda y modo B2C/B2B, sin cookies con atributo `Domain`.

## Verificación antes de habilitar

- Principal: home y canonical en su dominio.
- Hub: índice, enlaces a cada subdominio, `www` → 308 al apex conservando ruta/query.
- Dos tiendas diferentes: branding, catálogo y carritos independientes; la sesión de una no autentica a la otra.
- Alta: disponibilidad, nombre reservado, slug duplicado, error de importación y reintento; editar conserva el slug y la forma canónica elegida.
- Desconocido: home y página interna responden 404, sin datos de la principal.
- SEO: `robots.txt`, `sitemap.xml` y `llms.txt` se corresponden con cada host, también en una segunda solicitud. El hub permite indexación y enumera en sitemap únicamente su índice y las homes de tiendas por ruta. Cada subdominio publica su catálogo propio.
- Pago con entorno de prueba: retorno al mismo host/formato registrado del comprador. Rechazar URLs externas y otra tienda como destino. Verificar webhook en el backend y orden creada una sola vez.
- En producción, un `x-forwarded-host` enviado por el cliente no cambia la tienda resuelta por `Host`.
- Navegador: revisar CORS, desktop y móvil en principal, hub y colegio.

El documento describe el procedimiento; no acredita DNS, TLS, compra real ni despliegue de un cliente.

## Compatibilidad y reversión

Sin sufijo, se mantiene `/tienda/<slug>` en la base de siempre y no se requiere wildcard. Para volver a ese modo, quitar el sufijo tanto del storefront como del ajuste/env del backend y desplegar el storefront; las tiendas conservan sus datos. Los enlaces compartidos de subdominios requieren mantener el servicio o planificar redirecciones durante la transición: borrar una variable no conserva por sí solo esos enlaces.

El wildcard cubre un único nivel (`colegio.<hub>`), no `www.colegio.<hub>`. Las tiendas por ruta comparten robots y sitemap del hub; el índice publica sus homes, no todos sus productos. Las nuevas capacidades se distribuyen con los payloads y manifests correspondientes, sin ejecutar extractores destructivos.
