// Tiempos de debounce del buscador. Sin importaciones externas.
//
// Existían cinco valores distintos y accidentales para el MISMO buscador —400 ms
// en la barra de escritorio, 300 en el PLP, 250 en el modal, 200 en mobile, 180
// en el overlay de sports—, así que cada superficie se sentía como un producto
// diferente. Hay exactamente dos latencias que importan, y son distintas a
// propósito:

/**
 * Antes de empujar la query a la URL y navegar.
 *
 * Más alto que el de autocompletado porque una navegación cambia la página
 * entera: disparar de más se siente como que el sitio se sacude mientras uno
 * tipea. Los 400 ms de la barra de escritorio se sentían lentos; 250 ms es el
 * punto donde deja de percibirse el retardo sin volverse nervioso.
 */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * Antes de pedir sugerencias de autocompletado.
 *
 * Más bajo porque es una query barata, no reemplaza nada de lo que el usuario
 * está mirando y su valor está en aparecer mientras todavía se tipea.
 */
export const AUTOCOMPLETE_DEBOUNCE_MS = 180;
