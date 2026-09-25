# Primera entrega de fidelidad de Puck: landings

Alcance: fases 0–2 del plan `puck-fidelidad-visual.md`. Home, campañas, directorio y emails siguen pendientes. No se publica ni despliega antes de la validación visual del usuario.

## Implementación

El lienzo conserva los campos, la selección y el historial de Puck. Cada bloque monta un iframe del storefront que ejecuta **el mismo `LandingRenderer` y los mismos componentes** que la página pública. Así usa sus fuentes, CSS, tokens y catálogo, sin mantener otra copia visual en el Admin. Los iframes de bloques son inertes para conservar la selección y el arrastre de Puck.

«Ver cambios sin guardar» abre el documento completo con el header y footer reales. Incluye anchos 390, 768 y 1440, tienda y país. Las acciones comerciales y la navegación quedan desactivadas; los desplegables nativos de FAQ funcionan. Esta entrega no es un simulador completo de compra ni cambia la semántica existente de guardar/publicar.

La alternativa de vistas React compartidas sigue siendo útil si el coste de los iframes resulta excesivo. La decisión actual prioriza reutilizar exactamente el render server-side y evitar reconstruir Typesense, imágenes y estilos en el bundle del Admin. Hay una carga de documento por bloque; medir tiempos y consumo con landings largas antes de distribuir.

## Flujo

1. El Admin autenticado solicita un snapshot del documento en memoria, con tienda y país válidos para esa landing.
2. Redis conserva el snapshot inmutable durante diez minutos. Un token aleatorio de 256 bits permite leer únicamente esa revisión. El preview se renueva mientras el editor sigue abierto.
3. El proxy del storefront valida el token, fija el contexto de tienda y elimina cookies del comprador antes de renderizar. No modifica la landing almacenada.
4. Se omiten analítica, hidratación del carrito y gate de compra. El preview responde sin caché pública ni indexación y restringe el origen que puede enmarcarlo.
5. El iframe informa su altura mediante un mensaje con token, origen y ventana validados. Las respuestas antiguas no reemplazan una revisión nueva. Los filtros vacíos muestran un diagnóstico.

## Entorno local

La instalación normal está bloqueada por acceso 403 a paquetes privados. La instalación auxiliar bajo `tmp/puck-local-lock` enlaza los paquetes locales y no representa el lockfile de release.

El backend completo encuentra un conflicto previo de workflows duplicados (`create-payment-sessions`). Para probar esta entrega se creó una instancia Medusa con el plugin real de landings, en `tmp/puck-validation`, y una base independiente `mercatto_puck_visual`. PostgreSQL, Redis y Typesense corren en Docker. El storefront ejecuta el código de `apps/storefront` con variables que apuntan a estos servicios locales.

La fixture contiene una landing de borrador y seis productos locales. No valida datos, integraciones ni configuración de producción. El runner local activa la optimización de imports del barrel de recomendaciones para sortear su mezcla de exports cliente/servidor; esa adaptación no se aplica al código de producción.

## Revisión visual antes de release

- Comparar Hero, beneficios, productos, FAQ y CTA a 390/768/1440.
- Editar título e imagen sin guardar; abrir la página completa y verificar el cambio.
- Deshacer, duplicar y reordenar, manteniendo selección y scroll.
- Probar filtros vacíos, recuperación de error y tema oscuro del Admin.
- Revisar una tienda de campaña y otra plantilla, con sus fuentes, canal y colores reales.
- Verificar que guardar mantiene la semántica actual y que sólo abrir preview no guarda.

La distribución requiere resolver la instalación reproducible y los bloqueos del entorno completo, sincronizar artefactos de distribución, verificar perfiles generados y completar estas comparaciones. La fixture local por sí sola no autoriza ni prueba un deploy.

## Evidencia de esta sesión

- Build del plugin y sus extensiones Admin: correcto. Typecheck del plugin con dependencias React alineadas en una configuración auxiliar: correcto. El typecheck general del storefront no queda validado: la instalación auxiliar presenta conflictos React 18/19 en código existente.
- Cuatro pruebas automatizadas correctas: token/expiración, origen permitido, límite del documento y endpoint que usa cambios sin guardarlos.
- HTTP real: solicitud Admin sin sesión rechazada con 401; token desconocido rechazado con 404; preview válido 200 con `noindex, nofollow` y `frame-ancestors` limitado al Admin.
- Navegador: título modificado visible tanto en bloque como en página completa; lectura posterior del API conserva el título original. Seis productos y sus imágenes cargados. Vista completa comprobada a 390, 768 y 1440 px con las fixtures locales.
- Selección desde el bloque real, duplicación de 5 a 6 bloques y deshacer a 5 verificados. FAQ desplegable funcional; clic en agregar al carrito no emitió mutaciones de carrito/newsletter/analítica durante la prueba.
- Arrastre desde el lienzo verificado: Hero pasó debajo de beneficios y deshacer restauró el orden original. Los primeros intentos no activaban el sensor de Puck; el gesto sostenido sobre el centro del bloque sí lo activó. Quedan pendientes los otros templates, tiendas reales, tema oscuro y paridad de capturas contra una landing pública publicada.

Editor local: `http://localhost:9001/app/landing-pages/lpg_01M384ARAKHGDT9GCEQ64Z33BV`. Para reiniciar desde la raíz, en terminales separadas: `node tmp/puck-validation-run.cjs develop --no-lint -p 9001` y `node tmp/puck-start-storefront.cjs`. Los contenedores deben estar activos. Capturas en `output/playwright/puck-editor-desktop.png`, `puck-full-desktop.png`, `puck-full-mobile.png` y `puck-full-tablet.png`.
