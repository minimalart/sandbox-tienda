# Carta tintométrica de Alba: bajar los colores, las fotos y las fórmulas

Cómo se arma la data maestra del entonado cuando el fabricante es **Alba**
(AkzoNobel Argentina). Es el paso previo a todo lo demás: sin colores y sin
fórmulas el ERP no cotiza y la feature no tiene con qué funcionar.

Para la API del ERP ver [erp-zeus.md](./erp-zeus.md). Acá va sólo la carta.

## Por qué no alcanza con la home de Alba

`https://www.alba.com.ar/es/paletas-de-colores` pinta **384 swatches** (8 familias
x 48) y es una **selección editorial**, no la carta. Colores que el cliente busca
por nombre —"Pitanga", por ejemplo— existen en el sitio y no están ahí.

El universo real se enumera en **`/es/sitemap.xml`** (medido el 2026-08-05):

| | |
|---|---|
| URLs `/es/paletas-de-colores/<slug>-<ccid>` | **3.132** |
| …con código de fórmula en el nombre (`14YR 10/434`) | **2.848** |
| …sin código: esmaltes listos ("… Esm Std", "… Albalux") | 284 |
| Fotos de ambiente publicadas | **22.784** (8 x 2.848) |

El tab "Colecciones de Colores" es editorial y no tiene data. El buscador del
sitio (`POST /bin/api/colorSearch`) devuelve hex y colección, pero está **topeado
en 3 resultados** y robots.txt lo tiene `Disallow: /bin/api/*`; las páginas de
color sí están permitidas y en el sitemap, con `Crawl-delay: 10`.

## Paso 1 — bajar la carta

```bash
node scripts/tinting/harvest-alba-colors.mjs
```

Recorre el sitemap y saca de cada página el nombre con el código, el hex, la
familia (ya en castellano, del `<title>`) y las 8 fotos. Es **reanudable**:
guarda cada 25 colores y saltea lo que ya bajó, así que si se corta se vuelve a
correr y sigue.

Salida en `scripts/tinting/out/` (`out/` está en el `.gitignore` raíz por una
regla global, así que **la data generada no se commitea**; se mueve con `OUT_DIR`):

- `colors.json` — todo, con las fotos (3,3 MB).
- `colors.csv` — `codigo,nombre,carta,hex,familia,rank`, sólo los 2.848 entonables.
- `colors-con-fotos.csv` — lo mismo + la columna `imagenes`.

Duración: **~65 min** con el default de 1,2 s entre páginas. `DELAY_MS=10000`
respeta el `Crawl-delay: 10` del robots.txt y tarda ~8,7 h; se usó 1,2 s porque
es una corrida única sobre data estática. `LIMIT` y `OFFSET` acotan para probar.

Resultado de la corrida del 2026-08-05: **3.132 colores, 0 fallas**, 3.127 con las
8 fotos (los 5 sin fotos son industriales: piletas y techos), 12 familias, 100%
con hex. Ojo que **213 colores comparten hex con otro**: son colores distintos de
la carta que en pantalla se ven iguales, no un bug del harvest.

### Las dos trampas del crawl

Las dos están resueltas en el script; están acá porque cualquiera que escriba
otro crawler se las come igual.

1. **`new URL(u).pathname` ya viene percent-encoded.** Si le aplicás `encodeURI`
   otra vez, las **872 URLs con tilde** del sitemap dan 404 (`%C3%B3` pasa a
   `%25C3%25B3`). El sitemap además usa entidades (`&#243;`), así que hay que
   decodificarlas antes.
2. **La página de error de AEM devuelve HTTP 200**, con
   `<title>Not Found | Alba</title>` y los `data-item-*` de **otro color**. Sin
   validar que `data-item-id` sea el ccid de la URL, el harvest guarda hex
   cruzados y no hay manera de notarlo después.

## Paso 2 — importar los colores

`POST /admin/erp/tinting/import` con `kind: colors`. Arranca en **dry run**: sin
`dry_run: false` explícito devuelve el diff y no escribe.

El POST del admin **tira 413 arriba de ~100 KB**, así que va en tandas:

- `colors.csv` → tandas de **~500 filas**.
- `colors-con-fotos.csv` → tandas de **~100 filas** (cada fila suma ~800 bytes de
  URLs).

Se puede cargar la carta primero sin fotos y las fotos después: la columna
`imagenes` **distingue ausente de vacía**. Ausente no toca las fotos guardadas;
vacía las borra. Por eso reimportar la planilla del fabricante —que no trae
fotos— no pisa el harvest.

Las fotos se guardan como URL del CDN del fabricante en
`erp_tinting_color.metadata.images` y **no se copian a Spaces**: serían ~23.000
archivos. `GET /store/tinting/bases` las devuelve en `color.images` y el
storefront las muestra en el paso 2 de `/colores`.

## Paso 3 — medir qué códigos existen en Zeus

Que un código esté publicado por Alba no significa que Zeus tenga su fórmula. El
script pega directo a `GET /articulos/formulaTintometrico`.

```bash
MEDUSA_ADMIN_URL=… MEDUSA_ADMIN_TOKEN=… MODE=bases node scripts/tinting/zeus-coverage.mjs
```
```bash
ZEUS_JWT=… MODE=probe node scripts/tinting/zeus-coverage.mjs
```
```bash
ZEUS_JWT=… MODE=sweep node scripts/tinting/zeus-coverage.mjs
```

- **`bases`** baja las bases confirmadas y los colores ya cargados del admin.
- **`probe`** prueba una base por letra y corta en el primer 200: contesta "¿este
  código existe?" con ~2-3 llamadas por color en vez de 42.
- **`sweep`** barre las combinaciones `(línea, letra)` de los que existen y emite
  `formulas.csv` (`color,carta,linea,letra,formula`) para importar con
  `kind: formulas`.

Barrer los 2.848 códigos contra las 42 combinaciones son ~120.000 llamadas; el
probe primero recorta eso a los que realmente existen.

**El probe subestima**: la fórmula se resuelve por `(línea, letra)`, pero Zeus
tiene agujeros por ARTÍCULO (~6% medido), así que un color puede fallar en la
base representativa de su letra y andar en otra base de la misma letra. El sweep
es el que manda.

Semántica de Zeus que los dos modos asumen, toda medida:

- **`codFormula` va SIN ESPACIOS.** Gestión muestra `00NN 16/000` y con ese texto
  la API devuelve 409; `00NN16/000` devuelve 200.
- **409 "no existe" es el resultado negativo, no un error.** No hay forma de
  distinguir "la fórmula no existe" de "no aplica a esta base": el mensaje es el
  mismo. Sólo se reintentan red y 5xx.
- `lista` y `cantidad` son **enteros** (`1.0` da 400).
- `total: 0.0` con HTTP 200 es una **lista sin precio**, no una fórmula inexistente.

## Paso 4 — después del import

- Re-sincronizar Typesense si se tocaron productos
  (`POST /admin/typesense/sync`, y pollear el `GET`: el POST se corta por timeout
  del cliente pero el server sigue).
- Verificar `readiness` en `GET /admin/erp/tinting`.
- Revisar `/colores` en la tienda: es la primera pantalla donde se ven la carta
  nueva y las fotos.
