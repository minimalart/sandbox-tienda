# Mercatto Delivery — Checklist de deploy y verificación (flota propia)

Pasos para dejar el flujo de flota propia funcionando end-to-end en un entorno (staging/prod). El orden importa.

> **Contexto clave:** los subscribers (`own-fleet-order`, `delivery-execution-create`) solo se ejecutan en el backend que **corre el código mergeado**. Si el deploy está atrasado respecto a `main`, el auto-fulfill y el auto-create de execution NO se disparan, por más que el código exista en el repo. Este fue el motivo por el que las compras no entraban a Delivery.

## 0. Pre-requisitos de código

- [ ] El backend desplegado corre **`main`** (o una rama que incluya las PRs de delivery #212, #215, #217, #227, #250, #253, #255, #257). Confirmá el commit desplegado.
- [ ] Re-deploy / reinicio del backend tras actualizar el código (para que cargue subscribers y workflows nuevos).

## 1. Variables de entorno (backend)

- [ ] **`OWN_FLEET_AUTO_FULFILL=true`** — sin esto, las compras de flota propia no crean fulfillment automáticamente y no entran a Delivery.
- [ ] **`GOOGLE_MAPS_API_KEY`** — con **Geocoding API** habilitada en Google Cloud. Habilita el geocoding de respaldo cuando la dirección no trae lat/lng. Sin la key, el geocoding se saltea (no rompe) pero las direcciones sin coords no resuelven zona.
- [ ] **`ANDREANI_*`** (si se usa Andreani) — credenciales + `ANDREANI_AUTO_FULFILL=true` si se quiere auto-fulfill de Andreani.
- [ ] Región **ARS** con **MercadoPago** habilitado como payment provider (si falta, el checkout no muestra medios de pago).

## 2. Migraciones

- [ ] `npx medusa db:migrate` — aplica todas las tablas del módulo delivery (delivery_execution, driver, vehicle, driver_shift, delivery_zone, delivery_zone_resource, delivery_rule, route, route_stop, tracking_event, proof_of_delivery, etc.).

## 3. Seeds (en este orden)

- [ ] `pnpm db:seed` — base: regiones, stock location "Main Warehouse", productos demo.
- [ ] `pnpm seed:store-locations` — sucursales + **vincula `stock_location_id`** a Main Warehouse (habilita el fallback de resolución por stock-location).
- [ ] `medusa exec ./src/scripts/seed-own-fleet-shipping.ts` — shipping option "Flota Propia Mercatto".
- [ ] `pnpm seed:own-fleet` — vehículos (con/sin frío), repartidores + turnos, zonas, reglas, recursos por zona, producto refrigerado demo.
- [ ] `pnpm seed:coverage` — polígonos de cobertura (CABA) + linkeo zona↔cobertura.

## 4. Reinicio

- [ ] Reiniciar el backend (`npm run dev` en local, o re-deploy) para cargar subscribers/workflows.
- [ ] Reiniciar el storefront si las regiones cambiaron (cachea regiones).

## 5. Verificación automática (smoke-test)

- [ ] `medusa exec ./src/scripts/smoke-test-delivery.ts` — valida cada eslabón de configuración (datos seedeados, resolución geográfica, flags) y reporta ✓/✗ por eslabón. Es de **solo lectura**, no ensucia datos.

## 6. Verificación E2E (manual, en el admin + storefront)

- [ ] Carrito **nuevo** en el storefront (incógnito si re-seedearon regiones) → checkout con dirección en **CABA**.
- [ ] Elegir envío **"Flota Propia Mercatto"** → pagar (MercadoPago).
- [ ] La orden genera fulfillment **solo** (por `OWN_FLEET_AUTO_FULFILL`) → aparece una `DeliveryExecution` en **Delivery** con `store_location` y `zona` resueltos (sin parche manual).
- [ ] En el detalle de la execution → **"Auto-asignar"** elige un repartidor/vehículo elegible (excluye fuera de turno / sobrecargado / sin frío).
- [ ] En **Rutas → "Auto-armar rutas"** eligiendo Casa Central → agrupa las entregas respetando capacidad/temperatura.

## Troubleshooting rápido

| Síntoma | Causa probable | Fix |
|---|---|---|
| Compra no aparece en Delivery | `OWN_FLEET_AUTO_FULFILL` off, o deploy sin el subscriber | Setear flag + redeploy + reiniciar |
| Execution sin sucursal/zona | Sin coords ni cobertura ni stock-location link | Setear `GOOGLE_MAPS_API_KEY`, correr `seed:coverage` y `seed:store-locations` |
| "0 rutas creadas" en auto-armar | Executions sin `store_location_id`, o sin vehículos en la sucursal | Ver smoke-test; confirmar resolución de ubicación y `seed:own-fleet` |
| Checkout sin medios de pago | Región ARS sin MercadoPago | Agregar MercadoPago a la región en Settings → Regions |
| Checkout "unknown error" / countries | Carrito viejo apuntando a región borrada | Carrito nuevo (incógnito) + reiniciar storefront |
