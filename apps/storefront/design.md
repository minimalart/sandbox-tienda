# DESIGN.md - Mercatto

Sistema de diseño de Mercatto para un storefront de supermercado construido sobre Medusa. Este documento está escrito para humanos y para agentes de IA como Claude Code, Cursor, Copilot, v0, Lovable, Bolt y similares.

Mercatto es un supermercado digital moderno. La experiencia debe transmitir frescura, confianza, simplicidad y eficiencia. El producto, el precio y la acción de compra son siempre la prioridad.

> Idea rectora: fresh by default.
>
> Mercatto ayuda a las personas a hacer sus compras de manera simple, rápida y confiable. La interfaz debe sentirse limpia, luminosa y organizada. El blanco domina la composición. El verde funciona como señal de acción, disponibilidad y bienestar.
>
> Tagline: `fresh everyday`

---

## 1. Principios

### Producto primero

Las personas entran para comprar productos, comparar precios y completar un pedido. La interfaz nunca debe competir con:

- Imágenes de producto
- Nombre y presentación
- Precio
- Promociones reales
- Botones de compra

La decoración existe solo si mejora orientación, escaneo o confianza.

### Claridad antes que creatividad

Si una decisión visual reduce la velocidad de compra, se descarta. Mercatto prioriza:

1. Encontrar productos
2. Comparar opciones
3. Agregar al carrito
4. Editar cantidades
5. Finalizar la compra

### Frescura visual

La marca debe sentirse fresca, ordenada y confiable. Debe evitar sentirse tecnológica, corporativa, agresiva, oscura o futurista.

### Aire y simplicidad

Preferir espacios amplios, pocos colores, jerarquías claras y superficies limpias. Evitar exceso de contenedores, gradientes decorativos, sombras pesadas y layouts que parezcan dashboards empresariales.

---

## 2. Personalidad

Mercatto es:

- Cercano
- Claro
- Optimista
- Organizado
- Práctico

Mercatto no es:

- Premium extremo
- Corporativo
- Tecnológico
- Ruidoso
- Juvenil forzado

La interfaz debe sentirse cotidiana y útil, no aspiracional de lujo.

---

## 3. Color

### 3.1 Tokens principales

Usar estos tokens como fuente de verdad visual.

```css
:root {
  --mc-green: #2e7d32;
  --mc-green-hover: #256b2a;
  --mc-green-light: #81c784;
  --mc-green-pale: #e8f5e9;
  --mc-green-soft: #f4fbf4;

  --mc-yellow: #f9a825;
  --mc-yellow-soft: #fff8e1;
  --mc-red: #d32f2f;
  --mc-blue: #1976d2;

  --mc-ink: #111827;
  --mc-text: #374151;
  --mc-muted: #6b7280;
  --mc-subtle: #9ca3af;
  --mc-border: #e5e7eb;
  --mc-surface: #f9fafb;
  --mc-surface-strong: #f3f4f6;
  --mc-white: #ffffff;
}
```

### 3.2 Uso

- `--mc-green`: CTA principal, estado activo, disponibilidad, precio ganador, foco de navegación.
- `--mc-green-pale`: badges suaves, hover, bloques de confianza, estados seleccionados.
- `--mc-yellow`: promociones relevantes, descuentos y advertencias no críticas.
- `--mc-red`: errores, agotado, fallas de pago. No usar como color promocional principal.
- Neutros: estructura, bordes, textos, divisores, fondos.

### 3.3 Reglas cromáticas

- El blanco debe ocupar al menos 70% de la superficie visual.
- El verde es el único color de acción primaria.
- No usar más de un color protagonista por pantalla.
- No usar más de tres colores visibles simultáneamente, excluyendo fotos de productos.
- Evitar gradientes salvo campañas especiales. Si se usan, deben ser suaves y secundarios.
- No usar fondos oscuros para pantallas principales de compra.

### 3.4 Mapeo recomendado para Tailwind/shadcn

Si el proyecto usa variables tipo shadcn, mapear así:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 221 39% 11%;
  --card: 0 0% 100%;
  --card-foreground: 221 39% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 221 39% 11%;
  --primary: 123 46% 34%;
  --primary-foreground: 0 0% 100%;
  --secondary: 120 43% 95%;
  --secondary-foreground: 123 46% 24%;
  --muted: 210 20% 96%;
  --muted-foreground: 220 9% 46%;
  --accent: 120 43% 95%;
  --accent-foreground: 123 46% 24%;
  --destructive: 0 65% 51%;
  --destructive-foreground: 0 0% 100%;
  --border: 220 13% 91%;
  --input: 220 13% 91%;
  --ring: 123 46% 34%;
  --radius: 0.75rem;
}
```

---

## 4. Tipografía

### 4.1 Familias

```css
--mc-font-display: "Manrope", sans-serif;
--mc-font-body: "Inter", sans-serif;
```

Si solo puede cargarse una familia, usar `Inter`.

### 4.2 Uso

- `Manrope`: logo, navegación principal, títulos de campañas, headings grandes.
- `Inter`: producto, precio, formularios, checkout, filtros, tablas y contenido operativo.

### 4.3 Escala

| Token | Tamaño | Line-height | Peso |
| --- | ---: | ---: | ---: |
| Display XL | 64px | 72px | 700 |
| Display L | 48px | 56px | 700 |
| H1 | 36px | 44px | 700 |
| H2 | 28px | 36px | 700 |
| H3 | 22px | 30px | 650 |
| Body | 16px | 24px | 400 |
| Body Small | 14px | 20px | 400 |
| Caption | 12px | 16px | 500 |

### 4.4 Reglas

- No usar más de dos familias tipográficas.
- No usar texto hero en componentes internos.
- Los precios usan peso 700.
- Los nombres de producto usan peso 500 o 600.
- Los textos auxiliares usan gris, no baja opacidad.
- No usar letter-spacing negativo.

---

## 5. Espaciado y layout

### 5.1 Escala

Base: `4px`.

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128
```

### 5.2 Contenedores

- Desktop: ancho máximo recomendado `1200px` a `1440px`.
- Catálogo: grilla fluida con cards estables.
- Checkout: layout de dos columnas en desktop; una columna en mobile.
- Carrito lateral: ancho entre `380px` y `440px` en desktop.

### 5.3 Reglas

- Usar grillas para exploración de productos.
- Usar listas compactas para carrito, historial y reposición.
- Mantener dimensiones estables para imágenes, cards, botones, steppers y badges.
- Evitar cards dentro de cards.
- Evitar scroll horizontal salvo tablas comparativas o carruseles explícitos.
- En mobile, priorizar búsqueda, categorías, producto y carrito por encima de banners.

---

## 6. Forma y elevación

### 6.1 Radios

```text
radius-xs: 4px
radius-sm: 8px
radius-md: 12px
radius-lg: 16px
radius-xl: 24px
radius-full: 9999px
```

### 6.2 Uso

- Botones: `12px`.
- Inputs: `10px` o `12px`.
- Product cards: `12px`.
- Badges: `9999px`.
- Modales y drawers: `16px`.

### 6.3 Sombras

Usar sombras solo para separar capas flotantes:

```css
--mc-shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.06);
--mc-shadow-md: 0 8px 24px rgba(17, 24, 39, 0.10);
```

No usar sombras pesadas en cards de producto.

---

## 7. Componentes

### 7.1 Botón primario

Uso: acción principal de compra.

- Fondo verde
- Texto blanco
- Radius `12px`
- Alto mínimo `44px`
- Peso `600`

Ejemplos:

- Agregar al carrito
- Comprar ahora
- Continuar compra
- Confirmar pedido

No debe haber más de una acción primaria compitiendo en el mismo bloque.

### 7.2 Botón secundario

Uso: acciones alternativas.

- Fondo blanco
- Borde gris suave
- Texto oscuro
- Hover con fondo verde pálido si está relacionado con compra

Ejemplos:

- Ver detalle
- Seguir comprando
- Cambiar dirección
- Aplicar cupón

### 7.3 Botón ghost

Uso: acciones de baja prioridad.

- Sin borde
- Texto gris u oscuro
- Hover sutil

Ejemplos:

- Editar
- Quitar
- Limpiar filtros

### 7.4 Product Card

Es el componente más importante del sistema.

Jerarquía obligatoria:

1. Imagen
2. Nombre
3. Presentación o unidad
4. Precio
5. Promoción o beneficio
6. Selector de cantidad o CTA

Reglas:

- La imagen debe ocupar entre 40% y 60% de la card.
- La card debe tener altura estable dentro de una grilla.
- El botón no debe saltar de posición por nombres largos.
- El nombre puede ocupar 2 líneas máximo; luego truncar.
- El precio debe ser visible sin hover.
- Mostrar estado `Sin stock` sobre la acción, no escondido en texto pequeño.
- Evitar badges múltiples que compitan con el precio.

### 7.5 Precio

El precio debe ser uno de los elementos más visibles.

Formato recomendado:

```text
$ 2.490
```

Si hay descuento:

```text
$ 1.990
$ 2.490
20% OFF
```

Reglas:

- Precio final en verde o tinta fuerte.
- Precio anterior en gris, tachado.
- Badge de descuento en amarillo suave o verde pálido.
- No usar rojo para descuentos comunes.

### 7.6 Promociones

Las promociones acompañan al producto; no reemplazan la jerarquía de compra.

Usar para:

- 2x1
- 3x2
- Descuento por unidad
- Envío gratis
- Beneficio por suscripción

Evitar:

- Banners invasivos
- Rojo agresivo
- Animaciones parpadeantes
- Más de dos badges por card

### 7.7 Categorías

Las categorías deben ser escaneables y familiares.

Ejemplos:

- Frutas y verduras
- Carnes
- Lácteos
- Bebidas
- Almacén
- Congelados
- Limpieza
- Perfumería
- Mascotas

Reglas:

- Usar iconografía mínima y consistente.
- No reemplazar nombres de categorías por solo íconos.
- En mobile, usar chips horizontales o grilla compacta.

### 7.8 Búsqueda

La búsqueda es una acción primaria de navegación.

Reglas:

- Debe estar visible en header o primera sección del catálogo.
- Placeholder simple: `Buscar productos`.
- Resultados con imagen, nombre, precio y disponibilidad.
- Estados vacíos con sugerencias reales, no textos decorativos.
- Mantener historial o búsquedas populares si existe data.

### 7.9 Filtros

Usar filtros claros y de baja fricción:

- Categoría
- Marca
- Precio
- Promoción
- Disponibilidad
- Supermercado o sucursal, si aplica

En mobile, los filtros van en drawer o bottom sheet.

### 7.10 Quantity Stepper

El stepper debe ser fácil de tocar.

- Alto mínimo `36px`.
- Botones `-` y `+` con área táctil suficiente.
- Cantidad centrada.
- No cambiar el ancho cuando cambia el número.
- Deshabilitar `-` en cantidad mínima.

### 7.11 Carrito

El carrito debe ser extremadamente limpio.

Prioridades:

1. Productos
2. Cantidades
3. Subtotal
4. Descuentos
5. Envío
6. Total
7. Checkout

Reglas:

- Mostrar imagen pequeña, nombre, unidad, precio y stepper.
- El total debe estar fijo o muy visible.
- El checkout es el único CTA primario.
- Mantener `Seguir comprando` como acción secundaria.

### 7.12 Checkout

Comprar debe sentirse más como completar una lista que como llenar formularios.

Pasos recomendados:

1. Identificación
2. Dirección
3. Entrega
4. Pago
5. Revisión

Reglas:

- Una tarea por bloque.
- Labels visibles, no depender solo de placeholders.
- Errores junto al campo.
- Resumen de compra persistente en desktop.
- En mobile, resumen colapsable con total visible.

### 7.13 Estados vacíos

Los estados vacíos deben orientar la próxima acción.

Ejemplos:

- Carrito vacío: mostrar categorías frecuentes y CTA `Empezar compra`.
- Sin resultados: sugerir limpiar filtros o revisar búsqueda.
- Sin stock: permitir ver alternativas si existen.

No usar ilustraciones grandes que empujen la acción fuera de pantalla.

---

## 8. Iconografía

Sistema recomendado:

- Lucide
- Heroicons
- Phosphor

Elegir una sola familia por proyecto. Preferir íconos de stroke fino, geometría simple y aspecto amigable.

Usar íconos para:

- Buscar
- Carrito
- Usuario
- Favoritos
- Categorías
- Entrega
- Pago
- Sumar/restar
- Filtros

No usar íconos decorativos sin función.

---

## 9. Imágenes

### 9.1 Estilo

Fotografía luminosa, comercial y realista.

Priorizar:

- Alimentos frescos
- Iluminación natural
- Fondos blancos o claros
- Colores reales
- Producto reconocible

Evitar:

- Filtros intensos
- Imágenes oscuras
- Recortes excesivos
- Fotos genéricas de stock cuando se necesita ver el producto

### 9.2 Producto

- Fondo blanco preferentemente.
- Producto centrado.
- Sin sombras exageradas.
- Mantener proporción real.
- Usar placeholders neutros cuando no haya imagen.

### 9.3 Banners

Los banners deben vender una ocasión o beneficio concreto.

Buenos ejemplos:

- Frescos de temporada
- Ofertas de la semana
- Reposición rápida
- Envío gratis desde cierto monto

Evitar banners puramente decorativos.

---

## 10. Movimiento

Duraciones:

```css
--mc-duration-fast: 120ms;
--mc-duration-base: 200ms;
--mc-duration-slow: 300ms;
```

Reglas:

- La animación acompaña, no distrae.
- Usar transiciones para hover, apertura de drawer, feedback de agregar al carrito y cambio de cantidad.
- No animar precios de forma llamativa.
- Respetar `prefers-reduced-motion`.

---

## 11. Accesibilidad

Reglas mínimas:

- Contraste AA para texto.
- Área táctil mínima de `44px` en acciones principales.
- Labels visibles en formularios.
- Estados de foco visibles con verde o ring claro.
- No comunicar disponibilidad solo por color.
- Imágenes de producto con `alt` descriptivo.
- Botones de ícono con `aria-label`.
- Carrito, filtros y menús deben ser navegables con teclado.

---

## 12. Voz y microcopy

La voz debe ser clara, breve y útil.

Preferir:

- `Agregar`
- `Agregar al carrito`
- `Comprar ahora`
- `Seguir comprando`
- `Sin stock`
- `Disponible`
- `Retiro en tienda`
- `Envío a domicilio`

Evitar:

- Frases largas en botones
- Tono demasiado publicitario
- Humor en errores de checkout
- Mensajes vagos como `Algo salió mal` sin acción siguiente

Errores:

```text
No pudimos procesar el pago. Revisá los datos o probá otro método.
```

Vacíos:

```text
No encontramos productos para esta búsqueda.
```

---

## 13. Medusa storefront rules

Cuando se implemente UI sobre Medusa:

- Usar componentes del storefront existente antes de crear otros nuevos.
- Mantener el flujo nativo de regiones, carrito, checkout, customer account y payment sessions.
- No esconder errores de Medusa; traducirlos a mensajes claros.
- Mantener loading states para product lists, add-to-cart, quantity updates, checkout steps y payment submission.
- No bloquear la navegación por acciones secundarias.
- En product cards, separar `variant`, `price`, `availability` y `add-to-cart` en estados claros.
- Si un producto tiene variantes, no permitir agregar una variante ambigua.
- Si no hay stock, deshabilitar compra y ofrecer alternativa visual si existe.
- El carrito debe actualizar cantidades sin recargar la página cuando el stack lo permita.

---

## 14. Reglas para agentes de IA

Cuando una IA genere o modifique interfaces para Mercatto:

- Priorizar producto sobre decoración.
- Priorizar compra sobre marketing.
- Usar fondo blanco como base.
- Usar verde como único color de acción primaria.
- Mantener jerarquías simples.
- Mostrar precios de forma destacada.
- Usar grillas para exploración.
- Usar listas para reposición, carrito y checkout.
- Evitar layouts complejos.
- Evitar más de una acción primaria por bloque.
- No inventar promociones, precios, categorías, stock ni condiciones de envío.
- No crear landing pages si el pedido es construir una tienda, catálogo, checkout o componente funcional.
- No usar textos visibles para explicar cómo funciona la interfaz.
- No usar decoración que parezca SaaS, fintech o dashboard corporativo.
- No usar gradientes morados, fondos oscuros ni paletas monocromáticas.
- Mantener la estética limpia, fresca y confiable.

Checklist antes de finalizar UI:

- El producto se entiende en 3 segundos.
- El precio se ve sin hacer hover.
- El CTA principal es obvio.
- El carrito muestra total y próximos pasos.
- Los textos largos no rompen la card.
- Mobile tiene la misma prioridad de compra que desktop.
- Los estados loading, vacío, error y sin stock están resueltos.

---

## 15. Regla final

Si existe una duda de diseño, elegir siempre la opción más simple, clara y rápida para comprar.

Mercatto existe para ayudar a las personas a hacer sus compras, no para demostrar creatividad visual.
