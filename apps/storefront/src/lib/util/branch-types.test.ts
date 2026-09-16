import assert from "node:assert/strict"
import { test } from "node:test"

import { GEO_ZONES_AR, GEO_ZONES_AR_BY_ID } from "@lib/data/geo-zones-ar"
import {
  BRANCH_TYPE_STYLES,
  LEGACY_BRANCH_TYPES,
  branchTypeLabel,
  branchTypeStyle,
  resolveBranchTypes,
} from "@lib/util/branch-types"
import { matchesZone } from "@lib/util/store-locator-zones"

test("resolveBranchTypes distingue ausente, vacío y configurado", () => {
  // Ausente = la tienda nunca configuró la lista: los tres de siempre.
  assert.deepEqual(resolveBranchTypes(undefined), LEGACY_BRANCH_TYPES)
  assert.deepEqual(resolveBranchTypes({}), LEGACY_BRANCH_TYPES)
  // Vacío = elección deliberada: la tienda no clasifica sus sucursales.
  assert.deepEqual(resolveBranchTypes({ types: [] }), [])

  const custom = [{ id: "salon", label: "Salón", pickup: true }]
  assert.deepEqual(resolveBranchTypes({ types: custom }), custom)

  // La clave vieja hereda pickup y color del tipo homónimo.
  assert.deepEqual(
    resolveBranchTypes({
      categories: [{ type: "distribution_center", label: "Centro logístico" }],
    }),
    [
      {
        id: "distribution_center",
        label: "Centro logístico",
        pickup: false,
        color: "slate",
      },
    ]
  )
})

test("branchTypeStyle nunca rompe con un tipo desconocido", () => {
  const types = [
    { id: "salon", label: "Salón", pickup: true, color: "blue" },
    { id: "deposito", label: "Depósito", pickup: false },
  ]

  assert.equal(branchTypeStyle(types, "salon"), BRANCH_TYPE_STYLES.blue)
  // Sin `color`, cae en la paleta por posición (índice 1 = blue).
  assert.equal(branchTypeStyle(types, "deposito"), BRANCH_TYPE_STYLES.blue)
  // El caso que antes rompía la card al leer `.label` de un undefined.
  assert.equal(branchTypeStyle(types, "borrado"), BRANCH_TYPE_STYLES.slate)
  assert.equal(branchTypeStyle(types, ""), BRANCH_TYPE_STYLES.slate)
  assert.equal(branchTypeStyle([], "salon"), BRANCH_TYPE_STYLES.slate)
})

test("branchTypeLabel devuelve null en vez de un chip vacío", () => {
  const types = [{ id: "salon", label: "Salón", pickup: true }]
  assert.equal(branchTypeLabel(types, "salon"), "Salón")
  assert.equal(branchTypeLabel(types, "borrado"), null)
  assert.equal(branchTypeLabel(types, ""), null)
  assert.equal(branchTypeLabel(types, null), null)
})

test("el catálogo argentino tiene las 24 jurisdicciones y son consultables", () => {
  assert.equal(GEO_ZONES_AR.length, 24)
  assert.equal(GEO_ZONES_AR_BY_ID.size, 24)
  for (const zone of GEO_ZONES_AR) {
    assert.match(zone.id, /^ar-[a-z]$/)
    assert.ok(zone.label.length > 0)
    assert.equal(zone.geometry.type, "MultiPolygon")
    // Anillos cerrados de al menos 4 posiciones, que es lo que valida el
    // schema del backend y lo que necesita el ray-casting.
    for (const polygon of zone.geometry.coordinates) {
      for (const ring of polygon) {
        assert.ok(ring.length >= 4, `${zone.id}: anillo de ${ring.length} puntos`)
        assert.deepEqual(ring[0], ring[ring.length - 1], `${zone.id}: anillo abierto`)
      }
    }
  }
})

test("los presets ubican coordenadas reales en su jurisdicción", () => {
  const obelisco = { lat: -34.6037, lng: -58.3816 }
  const cordobaCapital = { lat: -31.4201, lng: -64.1888 }
  const ushuaia = { lat: -54.8019, lng: -68.303 }

  const caba = GEO_ZONES_AR_BY_ID.get("ar-c")!
  const cordoba = GEO_ZONES_AR_BY_ID.get("ar-x")!
  const tdf = GEO_ZONES_AR_BY_ID.get("ar-v")!

  assert.equal(matchesZone(obelisco.lat, obelisco.lng, caba), true)
  assert.equal(matchesZone(obelisco.lat, obelisco.lng, cordoba), false)
  assert.equal(matchesZone(cordobaCapital.lat, cordobaCapital.lng, cordoba), true)
  // Tierra del Fuego se generó recortando la Antártida y el Atlántico Sur:
  // la Isla Grande tiene que haber sobrevivido al recorte.
  assert.equal(matchesZone(ushuaia.lat, ushuaia.lng, tdf), true)
})
