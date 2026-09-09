<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Importador de catálogo

Trae el catálogo de WooCommerce, VTEX o Shopify a una tienda, o adopta un canal de venta que ya vive en esta instancia.

## Importar en la tienda principal o en una tienda existente

Abrí Tiendas, elegí Editar en la tienda de destino y entrá en Catálogo. El destino es siempre la tienda que estás editando, incluida la principal. La importación está incluida en Tiendas.

Elegí Importar catálogo, cargá el origen HTTPS público, proveedor y moneda. Activá la conexión y guardá. Previsualizar recupera hasta cinco productos sin escribir catálogo. Revisá precios y presentaciones, y luego usá Confirmar e importar. Importaciones recientes muestra avance y resultado.

Las conexiones nuevas están desactivadas. La ejecución se procesa cada minuto en segundo plano. Reimportar desde la misma conexión conserva los identificadores; una fuente parcial no elimina productos existentes. La activación B2B es independiente y no importa productos por sí misma.

## Orígenes del flujo anterior de creación de tiendas

WooCommerce, VTEX y Shopify son plataformas EXTERNAS: se leen por sus endpoints públicos y sus productos se normalizan a la forma de Medusa.

El cuarto origen, canal de venta, es distinto en especie. El catálogo YA vive en esta instancia, así que no hay nada que traer: la tienda ADOPTA ese canal y el import sólo lo mide. Si esperabas ver productos nuevos apareciendo, con este origen no van a aparecer, porque ya estaban.

El máximo de productos se puede dejar vacío para traer todo el catálogo público vendible de la fuente.

## El botón encola, el cron importa

Crear una tienda o darle a reintentar NO corre la importación: encola un trabajo pendiente. Quien lo ejecuta es un job programado, y es el único ejecutor.

Antes se corría en el momento, y ese es justamente el problema que esto resuelve: cualquier reinicio del contenedor a mitad de camino mataba la importación y dejaba el trabajo en "en curso" y la tienda en "Importando" para siempre.

Por eso una tienda recién creada puede pasar varios minutos en Importando sin que nada esté mal: está esperando su turno en la cola. El job procesa una sola importación por vez.

## Reintentar es seguro

La importación deduplica por identificador de producto y enlaza los que ya existen, así que un trabajo retomado después de un reinicio simplemente COMPLETA el catálogo en vez de duplicarlo.

Y una RE-importación fallida no degrada a "Falló" una tienda que todavía tiene catálogo usable: la configuración pública del storefront responde 404 salvo que la tienda esté Lista, así que un problema pasajero de la fuente no puede romper una tienda que está vendiendo.

## El umbral de importación huérfana

Es el único ajuste editable de esta extensión, y lo que decide es cuándo una importación en curso se da por muerta: si no registra avance durante ese tiempo, se marca como fallida y se libera la cola. El default son 20 minutos.

Subirlo de más deja la fila TRABADA, porque el job no arranca otra importación mientras crea que hay una viva. Bajarlo de más mata importaciones sanas que están procesando un lote grande y lento.

Se lee en CADA corrida del job, no una sola vez al arrancar. Eso es lo que permite moverlo mientras una importación grande está corriendo y que el cambio tenga efecto en la pasada siguiente.

## Cuando la fuente empieza a devolver 429

Eso no se arregla acá. El ritmo con el que el importador le pega a la tienda de origen —la espera mínima entre pedidos y la base del backoff— se configura en Tiendas, en su pantalla de configuración.

El importador distingue un bloqueo de un error: cuando la fuente limita las solicitudes, el mensaje dice que suele ser temporal y que se reintente en unos minutos, en vez del engañoso "no expone catálogo".

Si la fuente manda su propia cabecera de reintento, esa gana sobre el backoff configurado.

## Lo que parece configuración y no lo es

Hay dos variables de entorno que la extensión declara y que NO son configuración: son argumentos de línea de comandos de los scripts de backfill que quedaron disfrazados de variables.

Una es el interruptor de simulación contra escritura. Su valor por defecto, no escribir, es justamente la red de seguridad: persistirla en "escribir" convertiría todo simulacro futuro en una escritura real sin que nadie lo pida.

La otra acota una corrida a UNA tienda. Persistirla sólo lograría que la próxima corrida, sin querer, se limite a la tienda de la corrida anterior.

## La frecuencia del cron y la moneda van por entorno

El schedule del job lo hornea Medusa al arrancar y no se puede reprogramar desde el admin. Por defecto corre cada cinco minutos.

La moneda por defecto es de la INSTALACIÓN, no de esta extensión: la comparten el backfill de precios, el importador de VTEX del ERP y el indexador de búsqueda. Dos pantallas editándola es la receta para un catálogo mitad en una moneda y mitad en otra.
