# Credenciales centrales de Banners y Landings

Versiones de esta corrección: runtime **0.6.1**, Banners **1.0.5** y Landings
**1.0.2**. El host y los plugins usan el lector de `app-settings` registrado
por el backend. El registro del runtime usa `Symbol.for`/`globalThis` y funciona
con varias copias físicas compatibles en el mismo contexto de JavaScript.
Cada worker o proceso debe registrar su propio lector.

El backend fija runtime 0.6.1 y lo aplica también a las dependencias transitivas
mediante overrides de npm y pnpm. Es necesario actualizar las copias anteriores:
un runtime 0.4/0.5/0.6.0 conserva su registro privado y no participa del contrato
compartido. No se cambia la precedencia ni el cifrado de las credenciales.

## Validación

- `npm run build --prefix packages/contracts/plugin-runtime` y `npm test --prefix
  packages/contracts/plugin-runtime`: tres copias físicas, registro tardío,
  reemplazo, desconexión y lectores externos. La prueba falla contra 0.6.0.
- Builds de servidor y admin de ambos plugins y empaquetado con `pnpm pack`.
- `scripts/test-plugin-central-settings.ts` carga los `.tgz`, con una copia del
  runtime para el host y otra anidada dentro del plugin. Usa el servicio real
  del backoffice para guardar, cifrar, rotar y eliminar una clave sintética;
  la persistencia y OpenRouter son fixtures. Verifica que los clientes de texto
  e imagen reciben esa clave sin `OPENROUTER_API_KEY` en el entorno, que el estado
  administrativo es write-only y que se preservan defaults y reintentos cero.
- 97 pruebas de cifrado, resolución, precedencia, escritura, snapshot y aislamiento
  de tiendas del host.

La publicación ejecuta el contrato antes de publicar y lo repite descargando
los paquetes desde GitHub Packages. El segundo paso es el que confirma el
artefacto publicado; una prueba local no lo reemplaza.

## Secuencia de publicación y actualización

1. Publicar runtime 0.6.1 con `publish-plugin.yml` desde
   `codex/publish-central-credentials`.
2. Publicar Banners 1.0.5 y Landings 1.0.2 desde la misma rama y verificar los
   contratos de los paquetes descargados del registro.
3. Regenerar `apps/backend/package-lock.json` y `pnpm-lock.yaml` en la rama
   `codex/runtime-central-credentials` del boilerplate y de Vital, mediante
   `refresh-backend-locks.yml`. Ejecutar `node scripts/verify-backend-lock.js`:
   además de la raíz, comprueba que no quede un runtime anidado distinto.
4. Revisar checks y diffs de los locks, integrar y verificar el despliegue de
   Vital. Mantener las credenciales actuales; no crear una variable de entorno.
5. Verificar en `/admin/app-settings?namespace=extension:ai-assistant` que la
   clave tenga origen global, `env_present: false` y `decryptable: true`.
   Probar el generador de Banners (no persiste el copy) y Landings con
   `mode: draft_only`, sin publicar ni reemplazar contenido existente.

## Estado de esta ejecución — 2026-09-13

La lectura por API de Vital confirmó clave global, descifrable y ausente del
entorno. No se modificó la configuración de Vital.

Actions volvió a ejecutar trabajos después de habilitar presupuesto. Publicaciones verificadas:

- Runtime 0.6.1: https://github.com/minimalart/medusa-b2c-boilerplate/actions/runs/34776903596
- Banners 1.0.5: https://github.com/minimalart/medusa-b2c-boilerplate/actions/runs/34776987772
- Landings 1.0.2: https://github.com/minimalart/medusa-b2c-boilerplate/actions/runs/34776989998

Los dos plugins pasaron el contrato de credenciales centrales sobre el artefacto
empaquetado y el descargado del registro. Los locks del boilerplate se regeneraron
en Actions y el verificador confirma una sola versión compatible del runtime.

Los locks de Vital también se completaron con las resoluciones verificadas del
boilerplate, adaptadas a sus manifests. npm y pnpm aprobaron la resolución offline,
y pnpm validó además frozen-lockfile. Solo cambian Runtime, Banners y Landings en
el lock npm. Su workflow sigue sin acceso a plugin-space-designer (HTTP 403).
No se cambió la clave de OpenRouter ni se agregó al entorno. La actualización
y las pruebas reales de los generadores en Vital siguen pendientes del despliegue.
