<!--
  ARCHIVO GENERADO — no editar a mano.
  Fuente: apps/backend/src/admin/help/<extension>.ts
  Regenerar: cd apps/backend && npm run docs:extensions
  Un test de sincronía (src/admin/help/docs-sync.test.ts) falla si esto quedó viejo.
-->

# Landings con IA

Arma landings con un editor visual de bloques y las puede generar, traducir y mejorar con IA.

## Dos pantallas para dos cosas distintas

Esta pantalla gestiona la CONFIGURACIÓN de la página: título, slug, estado, idioma, SEO y a qué tienda pertenece.

El contenido —los bloques, sus textos y sus imágenes— se edita en el editor visual, que se abre con el botón de editar contenido y es otra pantalla.

El botón de publicar del editor visual guarda el borrador del contenido. La publicación de la landing, la que la hace visible en el storefront, se hace desde el listado.

## Una landing sin tienda es global

Una landing sin canal de ventas se publica en TODAS las tiendas. No es una landing huérfana: es exactamente cómo la trata el storefront.

Por eso el listado la muestra estando en cualquier tienda. Si el admin la escondiera, alguien vería una URL viva que no aparece en ninguna parte de su backoffice.

## Sin credencial, el botón de IA devuelve un error de servicio

La API key de OpenRouter no se edita en esta extensión: la gestiona la card del Asistente IA, y acá se lee EL MISMO valor efectivo, no el entorno.

Es una credencial compartida por cuatro extensiones. Si cada una la declarara, habría cuatro filas compitiendo por la misma key y rotarla dejaría a tres autenticando con la vieja.

En un proyecto generado sin el Asistente IA, la lectura cae a la variable de entorno como siempre. Y sin credencial por ninguno de los dos caminos, cada acción de IA devuelve un 503: no es un problema de la landing.

## El modelo de texto no es el del chat

Por el nombre de la variable parece un ajuste de OpenRouter, y no lo es: es el modelo que genera la ESTRUCTURA de la landing y el copy de los banners. El chat del Asistente IA usa otro, en su propia card.

Tiene que ser un modelo que respete el formato de respuesta JSON estricto. El generador le pide un documento JSON y lo valida contra el esquema de bloques; si el modelo devuelve prosa o lo envuelve en explicaciones, la respuesta no parsea.

Un modelo charlatán, entonces, no falla con un mensaje claro: gasta los reintentos y recién ahí devuelve error.

## Los reintentos son caros

Cada reintento es una llamada COMPLETA al proveedor, con su costo. Lo que se reintenta es la petición pidiendo corrección del JSON, no una parte.

Con cero, un modelo que responde mal hace fallar la generación a la primera. El tope de cinco existe para que un modelo mal elegido no queme el presupuesto en una sola landing.

Estos dos valores —modelo y reintentos— son la capa de INSTANCIA. La personalización por tienda ya existe por otro camino, en las preferencias de IA, y esas rutas se los pasan al generador por argumento: cuando hay valor de tienda, gana.

## Qué hace cada acción de IA

Generar arma la estructura completa desde una descripción y reemplaza el contenido, así que conviene usarla sobre una landing vacía o duplicada.

Mejorar copy conserva la ESTRUCTURA y los links: sólo reescribe los textos. Traducir hace lo mismo cambiando de idioma.

Generar imágenes completa primero los huecos —un hero sin imagen, un bloque de imagen sin fuente— y sólo si no hay ninguno pregunta si se quieren regenerar las existentes.

## Las imágenes se generan sin texto

Las imágenes salen sin texto adentro y con buen contraste, a propósito: el copy se superpone aparte, como un bloque del editor, y así se puede editar y traducir sin volver a generar la imagen.

Es también la razón por la que pedirle a la IA un banner con una frase adentro no funciona bien: esa frase quedaría quemada en el pixel.

El estilo es opcional. Vacío, lo elige el modelo.
