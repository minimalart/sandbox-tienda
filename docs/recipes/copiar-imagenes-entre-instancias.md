# Copiar imágenes de producto de otra instancia

Cuando una tienda arranca con el catálogo de un ERP que **otra instancia ya tiene
poblado**, hereda el problema de las fotos: el catalog sync sólo baja las que el
ERP sirve, y lo que el ERP no tiene —o devuelve con error— se publica sin imagen.
Si la otra instancia ya las bajó, se pueden traer.

`scripts/catalog/copy-product-images.mjs` hace eso: cruza por SKU, baja el
archivo del origen y lo **vuelve a subir al bucket de esta instancia**.

## Antes de correrlo, entender qué decide

**Una imagen puesta por acá no se sobrescribe nunca.** `planProductImages`
saltea todo producto que ya tenga foto — es la regla de oro del módulo ERP y es
correcta: si pisáramos la foto buena del cliente con el JPEG de 200×200 del ERP,
la original no vuelve. La consecuencia es que copiar es *decidir que la foto del
origen es la definitiva* para ese producto.

**No reemplaza al sync.** Es una operación de puesta a punto. Si el ERP tiene la
foto y el sync no la está trayendo, el problema es otro y hay que mirarlo:
empezar por `GET /admin/erp/sync-logs?type=catalog_sync` y comparar `planned`
contra `imported` en varias corridas seguidas. Si `imported` es 0 sostenido, la
fase de imágenes está trabada y copiar sólo tapa el síntoma.

## Uso

```bash
# 1. Preview. No escribe nada; deja el plan completo en out/plan.json
SOURCE_URL=https://back-otra.example \
SOURCE_PK=pk_… \
MEDUSA_ADMIN_URL=https://back-esta.example \
MEDUSA_ADMIN_TOKEN=… \
  node scripts/catalog/copy-product-images.mjs

# 2. Un lote chico, para verlo en la tienda antes de largar todo
APPLY=1 LIMIT=10 node scripts/catalog/copy-product-images.mjs

# 3. Todo. Reanudable: out/copied.json se guarda cada 25
APPLY=1 node scripts/catalog/copy-product-images.mjs
```

El origen se lee por su **API pública de store**, así que sólo hace falta su
publishable key. El admin token es el de la instancia **destino**, que es donde
se sube y se escribe.

| Variable | Default | Qué es |
|---|---|---|
| `SOURCE_URL` / `SOURCE_PK` | — | Instancia de la que se copia |
| `MEDUSA_ADMIN_URL` / `MEDUSA_ADMIN_TOKEN` | — | Instancia destino |
| `APPLY` | vacío | Sin esto es preview |
| `LIMIT` | ∞ | Cuántos productos copiar |
| `DELAY_MS` | 150 | Pausa entre productos |
| `OUT_DIR` | `scripts/catalog/out` | Está en el `.gitignore` |

## Cómo leer el reporte

```
  copiables (match único con foto) : 405
  el origen tampoco tiene foto     : 435
  SKU ambiguo en el origen         : 0
  SKU inexistente en el origen     : 34
```

- **el origen tampoco tiene foto** — el SKU existe allá y tampoco tiene imagen.
  Copiar no puede ayudar: la foto no existe en ningún lado y la única salida es
  cargarla en el ERP.
- **SKU ambiguo** — dos productos distintos del origen comparten el SKU y tienen
  imágenes distintas. El script **no elige**: los descarta y los lista. Pasa
  cuando el origen es una instancia con varios demos, donde códigos cortos como
  `129` se repiten.
- **SKU inexistente** — típicamente artículos que sólo existen en el destino, o
  pseudo-artículos del ERP (`FLETE`, `REGALIAS`).

**Mirá la muestra de títulos que imprime.** Es la validación barata de que el
cruce por SKU está apuntando al mismo artículo:

```
      710  Efectos especiales design velvet n ← Efectos especiales design velvet n
      172  ALBALATEX MATE INTERIOR BASE F X 0 ← Albalatex mate interior x1 lt
```

El segundo caso se ve distinto y está bien: es el mismo artículo del ERP con
otra normalización de título (regla R26, que saca el `Base F`). Un título que
describe **otro producto** sí es una alarma.

## Trampas medidas

- **`fields=*variants.sku` no expande los SKUs.** Vuelven vacíos y el cruce da
  cero sin un solo error. Hay que pedir `*variants` entero. El script ya lo hace;
  queda escrito acá porque cuesta media hora descubrirlo.
- **Se copia el archivo, no la URL.** Apuntar el producto al bucket del origen
  dejaría la tienda dependiendo de la infraestructura de otro cliente. El script
  sube por `POST /admin/uploads`, campo `files`.
- **Es deuda, no una fuente.** El catálogo del destino termina con imágenes cuyo
  origen es la base de otra instancia y no su propio ERP. Funciona y no rompe
  nada, pero lo correcto sigue siendo cargar las fotos en el ERP.

## Precedente

desdeelsur, 2026-08-25: 874 productos sin imagen → 405 copiados desde mercatto
(116,6 MB, sin fallos), 469 sin origen posible. Ver también
`docs/recipes/erp-zeus.md` para el comportamiento de la fase de imágenes.
