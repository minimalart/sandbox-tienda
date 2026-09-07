# E2E Tests con Playwright

Este directorio contiene las pruebas end-to-end (E2E) para la aplicación usando Playwright.

## Instalación

Primero, instala las dependencias de Playwright:

```bash
npm install
npx playwright install
```

## Ejecutar las pruebas

### Modo headless (sin interfaz gráfica)
```bash
npm run test:e2e
```

### Modo UI (interfaz interactiva)
```bash
npm run test:e2e:ui
```

### Modo headed (con navegador visible)
```bash
npm run test:e2e:headed
```

### Modo debug (paso a paso)
```bash
npm run test:e2e:debug
```

## Estructura de las pruebas

### `add-to-cart.spec.ts`
Pruebas para la funcionalidad de agregar productos al carrito:

- ✅ Agregar producto desde quick view (productos destacados)
- ✅ Agregar producto desde página de detalle
- ✅ Abrir mini-cart drawer
- ✅ Cambiar selección de variantes
- ✅ Verificar ícono de check en opción seleccionada
- ✅ Verificar que opciones vienen preseleccionadas

### `search.spec.ts`
Pruebas para la funcionalidad de búsqueda:

- ✅ Filtrar productos por texto
- ✅ Limpiar búsqueda y mostrar todos los productos
- ✅ Verificar botón de búsqueda por voz
- ✅ Combinar búsqueda con ordenamiento
- ✅ Mostrar mensaje cuando no hay resultados
- ✅ Persistir query de búsqueda al navegar
- ✅ Actualizar resultados en tiempo real

## Requisitos previos

Antes de ejecutar las pruebas, asegúrate de que:

1. El servidor de desarrollo esté corriendo en `http://localhost:8000`
2. La base de datos de Medusa esté configurada y tenga productos
3. Tengas al menos un producto con variantes para probar la selección

## Notas importantes

- Las pruebas usan el país `ar` (Argentina) por defecto
- El servidor se inicia automáticamente si no está corriendo
- Los errores de TypeScript sobre `@playwright/test` se resolverán después de `npm install`
- Las pruebas esperan que haya productos en la base de datos

## Ver reportes

Después de ejecutar las pruebas, puedes ver el reporte HTML:

```bash
npx playwright show-report
```

## Debugging

Si una prueba falla, Playwright genera:
- Screenshots en `test-results/`
- Videos (si están habilitados)
- Traces que puedes ver con `npx playwright show-trace <trace-file>`
