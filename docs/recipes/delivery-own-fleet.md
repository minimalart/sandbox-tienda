# Mercatto Delivery — Flota propia: cómo funciona y cómo probarlo

Guía para entender la capa de flota propia (vehículos, repartidores, zonas, reglas, asignación automática y rutas) y probarla de punta a punta.

---

## 1. La idea en una frase

Medusa sigue siendo el dueño de la **verdad comercial** (orden, pago, shipping option, fulfillment: creado → enviado → entregado). Mercatto Delivery agrega una capa de **operación logística** que vive al lado, sin duplicar nada de Medusa.

La entidad central es **`DeliveryExecution`**: un "sidecar" 1:1 de cada `Fulfillment`. No copia la dirección ni los ítems del pedido —los lee en vivo— y solo guarda el estado operativo fino (asignado, retirado, en ruta, entregado) más las referencias a driver/vehículo/ruta/zona.

```
Checkout (Medusa)
   │  el cliente elige "Flota Propia Mercatto"
   ▼
Fulfillment creado  ──(evento)──►  se crea DeliveryExecution (provider_type = own_fleet)
                                        │
                                        ├─ se clasifica la zona y se evalúan las Reglas
                                        ├─ ELEGIBILIDAD: ¿qué drivers/vehículos pueden?
                                        ├─ ASIGNACIÓN: se elige uno (manual o automática)
                                        └─ RUTAS: se agrupan varias executions en una ruta
```

---

## 2. Las piezas (qué hace cada una)

| Pieza | Qué resuelve | Dónde vive |
|---|---|---|
| **Vehicle** | Capacidad (kg, m³, **cantidad de pedidos**) y **refrigeración** (`temperature_modes`) | `models/vehicle.ts` |
| **Driver** | Repartidor + disponibilidad: estado, **carga máxima** (`max_active_deliveries`) y **turnos** (`DriverShift`) | `models/driver.ts`, `models/driver-shift.ts` |
| **DeliveryZone** | Zona logística (SLA, tarifa, providers habilitados) | `models/delivery-zone.ts` |
| **ZoneResource** | Qué drivers/vehículos están habilitados **por zona** (N:M) | `models/zone-resource.ts` |
| **DeliveryRule** | Reglas: "si el pedido cumple X → usá tal proveedor / estrategia / recargo" | `models/delivery-rule.ts` + `rules-engine.ts` |
| **Elegibilidad** | Dada una entrega, qué recursos PUEDEN llevarla (filtra por zona, capacidad, frío, turno, carga) | `fleet-eligibility.ts` (puro) + `service.getEligibleResources` |
| **Asignación auto** | Entre los elegibles, elegir uno (round robin / primero libre / menor carga) | `assignment-strategies.ts` + workflow `auto-assign-delivery` |
| **Auto-rutas** | Agrupar entregas en rutas respetando capacidad y temperatura | `route-builder.ts` (puro) + workflow `auto-build-routes` |

**Concepto clave de "temperatura":** un producto se marca como refrigerado/congelado en `variant.metadata.temperature`. El requisito de una entrega es el **máximo de frío** de sus ítems. Un vehículo solo puede llevarla si soporta ese modo (`temperature_modes`).

---

## 3. Preparar el entorno (una sola vez)

```bash
cd apps/backend

# 1. Migraciones (crea driver_shift, zone_resource y las columnas nuevas)
npx medusa db:migrate

# 2. Datos base (si no los tenés)
pnpm seed:store-locations      # sucursales
pnpm db:seed                   # productos demo

# 3. Envío "Flota Propia Mercatto" (shipping option)
medusa exec ./src/scripts/seed-own-fleet-shipping.ts

# 4. Casos de uso de flota (vehículos, repartidores, turnos, zonas, reglas, producto refrigerado)
pnpm seed:own-fleet

# 5. Levantar
npm run dev          # backend + admin
```

---

## 4. Qué te dejó el seed (tus datos de prueba)

**Vehículos:**
| Nombre | Tipo | Máx pedidos | Frío |
|---|---|---|---|
| Moto 01 | moto | 8 | ❌ solo ambiente |
| Van Frío 01 | van | 20 | ✅ ambiente + refrigerado + congelado |
| Auto 01 | auto | 12 | ❌ solo ambiente |

**Repartidores:**
| Nombre | Carga máx | Turno |
|---|---|---|
| Juan Pérez | 5 | lun–vie 09:00–18:00 |
| María López | 8 | lun–vie 09:00–18:00 |
| Carlos Díaz | 3 | lun–vie **solo 14:00–18:00** |

**Zonas:** "Zona Urbana" (estrategia `least_load`, con Van Frío 01 + Juan Pérez asignados) · "Zona Extendida" (estrategia `round_robin`, **sin recursos** → cualquiera de la sucursal es elegible).

**Reglas:** livianos → flota propia · refrigerados → ruteo manual · zona urbana → round robin + auto-asignar · después de las 18:00 → primero disponible.

**Producto refrigerado:** la variante de SKU `REMERA-S-NEGRO` quedó marcada `temperature: refrigerated` (es el "helado" de la demo).

---

## 5. Flujo de prueba en el admin

### Paso A — Mirá los datos
En el menú lateral **Delivery** abrí cada sub-pantalla: **Repartidores** (mirá los turnos de Carlos), **Vehículos** (mirá el frío de la Van), **Zonas** (mirá los recursos de Zona Urbana), **Reglas**. Confirmá que los desplegables abren y que los datos del seed están.

### Paso B — Generá una entrega de flota propia
1. En el storefront, hacé un pedido eligiendo el envío **"Flota Propia Mercatto"**.
2. Volvé al admin → **Delivery** (ops board). Debería aparecer una `DeliveryExecution` nueva con `provider_type = own_fleet`.

### Paso C — Asignación (acá se ve la elegibilidad)
1. Click en la fila de la execution → se abre el detalle.
2. Tocá **"Ver candidatos"**: vas a ver los drivers/vehículos **elegibles** y los **rechazados con el motivo** (fuera de turno, sobrecargado, sin frío, zona no habilitada).
3. Tocá **"Auto-asignar"**: el sistema elige uno aplicando la estrategia de la zona/regla.

### Paso D — Auto-armado de rutas
1. Generá **varias** entregas de flota propia (repetí el Paso B unas cuantas veces).
2. En **Delivery → Rutas** → botón **"Auto-armar rutas"**.
3. Elegí la sucursal → genera rutas agrupando las entregas por capacidad y temperatura, y te muestra cuántas rutas creó y cuántas entregas quedaron sin asignar.

---

## 6. Casos que validan cada requisito

Probá estos escenarios concretos para ver cada regla "en acción":

| Querés ver… | Hacé esto | Resultado esperado |
|---|---|---|
| **Refrigerados solo en vehículo apto** | Pedido con la variante `REMERA-S-NEGRO` (refrigerado) → Ver candidatos | Solo "Van Frío 01" elegible; "Moto 01" y "Auto 01" rechazados por `temperature_not_supported` |
| **Turno del repartidor** | Auto-asignar **fuera de 14–18h** | "Carlos Díaz" NO elegible (fuera de turno); dentro de 14–18h sí aparece |
| **Carga máxima** | Asigná a un repartidor hasta su tope (`max_active_deliveries`) | Al superarlo deja de ser elegible (`over_capacity`) |
| **Capacidad de ruta** | Auto-armar rutas con más de 8 entregas livianas | La "Moto 01" (máx 8) se llena y el resto va a otro vehículo o a "sin asignar" |
| **Recursos por zona** | Entrega en "Zona Urbana" vs "Zona Extendida" | En Urbana solo Van Frío 01 + Juan; en Extendida (sin recursos) cualquiera de la sucursal |
| **Estrategia de asignación** | Auto-asignar varias veces en Zona Extendida (round_robin) | Va rotando entre repartidores; en Urbana (least_load) elige el de menor carga |

---

## 7. Inspección por backend (sin el admin)

Si querés ver el motor crudo, podés escribir un script `medusa exec` que llame:
- `service.getEligibleResources(executionId)` → devuelve `{ eligible_drivers, eligible_vehicles, rejected }` con motivos.
- el workflow `auto-assign-delivery` con un `execution_id`.
- el workflow `auto-build-routes` con `{ store_location_id }`.

Esto ejercita toda la lógica sin depender de la UI. (Pedímelo y te lo armo como smoke-test reproducible.)

---

## 8. Límites actuales (para no confundirte)

- **El recargo de las reglas (`surcharge`) NO se le cobra al cliente.** Las reglas se evalúan después del checkout, así que el surcharge se guarda como **costo operativo** (`estimated_cost`), no como cargo. Para cobrarlo habría que moverlo al checkout.
- **"Delivery más barato" es una heurística, no una comparación de tarifas en vivo.** Una regla fuerza un proveedor según condiciones (peso, etc.); el sistema no cotiza Andreani vs flota en tiempo real.
- **Multi-provider (OCA, Correo Argentino) y el comparador de tarifas al cliente** todavía no están — es una fase futura.
- **La auto-asignación es manual (por botón).** No se dispara sola al crear el pedido; eso queda como extensión.
- **Las zonas se resuelven por sucursal**, no por geometría, salvo que cargues un `BranchCoverage` (polígono) en la zona.
