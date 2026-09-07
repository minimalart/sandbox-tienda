<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Catalogador

Completa fichas de producto con IA —título, descripción, SEO e imágenes— y nada se aplica al catálogo sin revisar.

## La ejecución es en dos tiempos

Una ejecución agrupa los productos a catalogar. Primero se GENERA: la IA propone campos de texto e imágenes y todo queda como propuesta, sin tocar el catálogo. Después se APLICA, y recién ahí se escribe en el producto.

Entre los dos momentos está la revisión, que es el punto de la extensión. Se puede aceptar campo por campo, y con la revisión de baja confianza prendida los campos de los que el modelo no está seguro quedan trabados hasta que alguien los mire.

Antes de aplicar se guarda un snapshot del producto, así que una tanda mal aplicada se puede restaurar. Es la red de seguridad de toda la extensión: conviene no apagarla.

## Cuál de las dos configuraciones gana

Los modelos de IA se pueden editar en dos lugares y no empatan. La cadena completa, de mayor a menor prioridad, es: la configuración del Catalogador, después lo guardado en los ajustes de la extensión, después la variable de entorno, y al final el valor por defecto.

O sea que lo que se carga en la card de ajustes es el DEFAULT de la pantalla de configuración. Si se cambia el modelo ahí y no pasa nada, es porque la configuración del Catalogador tiene un valor propio pisándolo.

Las credenciales de barcode y de scraping no participan de esa cadena: se guardan cifradas y sólo se editan en la card de ajustes.

## El modelo de texto tiene que ver la imagen

El modelo de texto no sólo lee los datos del producto: también mira su foto para proponer título, descripción y SEO. Tiene que ser multimodal.

Con un modelo que sólo procesa texto la generación no falla: devuelve propuestas escritas mirando nada más que el nombre y los atributos, que es exactamente lo que se veía antes de la extensión.

## El enriquecimiento externo falla callado

La consulta por código de barras necesita una URL con el marcador de posición del código adentro. Sin él, la misma URL se consulta para TODOS los productos y devuelve siempre lo mismo: no hay error, hay una ficha equivocada repetida en todo el catálogo.

Lo mismo con el template de búsqueda del proveedor http: sin el marcador de la consulta, el pedido es constante. Y el host que salga de armar esa URL tiene que estar en los dominios permitidos, o el guard anti-SSRF lo bloquea antes de salir.

Con el proveedor recomendado, sin su API key el enriquecimiento web se saltea con un warning en los logs del backend. Desde el admin la ejecución se ve normal, sólo que sin datos de la web.

## Las reglas de catálogo son la diferencia entre completar y pisar

Por defecto la extensión no sobrescribe lo cargado a mano y no reemplaza sola la imagen principal. Son las dos reglas que hacen que se pueda correr sobre un catálogo vivo.

Apagarlas convierte al Catalogador en algo distinto: una herramienta que reescribe fichas ya revisadas. Es legítimo para una migración, pero conviene hacerlo con el snapshot prendido y sobre una tanda chica.

## La API key de OpenRouter no se edita acá

La credencial de OpenRouter la comparten cuatro extensiones: el Catalogador, SEO y GEO, el Asistente IA y el generador de landings. La edita un solo namespace para que no haya cuatro filas compitiendo por el mismo valor y rotarla no deje a tres autenticando con la vieja.

La otra variable de OpenRouter, la de atribución, sólo alimenta las cabeceras con las que el proveedor identifica el consumo en su panel: no cambia ningún resultado.

## La frecuencia del job y el alcance por tienda

El horario del job del Catalogador es una variable de entorno y no se puede cambiar desde el admin: Medusa lo hornea al arrancar y no lo vuelve a consultar. Cambiarlo pide tocar el entorno y volver a desplegar.

Todo lo demás es por tienda: cada catálogo se cataloga con sus propios parámetros y el selector de arriba decide cuál se está editando.
