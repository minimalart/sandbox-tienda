import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveQuickSuggestionTarget,
  type CategoryNode,
} from "./quick-suggestion-target";

/**
 * DESDEELSUR-61, BUG-11: los atajos "Explorar:" del header navegaban por búsqueda de
 * texto (`/store?q=pinturas`) en vez de por categoría, y devolvían removedores,
 * imprimaciones y bases.
 *
 * El árbol de abajo son las categorías REALES de desdeelsur leídas del HTML de
 * producción — incluye que "Barnices" NO existe, que es el caso que obliga a que el
 * fallback degrade en vez de inventar una categoría.
 */
const cat = (name: string, children: CategoryNode[] = []): CategoryNode => ({
  name,
  href: `/store?category=${encodeURIComponent(name)}`,
  children,
});

const DESDEELSUR: CategoryNode[] = [
  cat("Pintura"),
  cat("Pinceles"),
  cat("Rodillos"),
  cat("Aerosoles"),
  cat("Artística"),
  cat("Accesorios", [cat("Abrasivos"), cat("Cintas")]),
];

test("category explícita gana y no mira el árbol", () => {
  const target = resolveQuickSuggestionTarget(
    { label: "Lo que sea", category: "Pintura", query: "otra-cosa" },
    DESDEELSUR,
  );
  assert.deepEqual(target, { kind: "category", category: "Pintura" });
});

test("BUG-11: 'Pinturas' resuelve a la categoría Pintura, no a ?q=", () => {
  const target = resolveQuickSuggestionTarget(
    { label: "Pinturas", query: "pinturas" },
    DESDEELSUR,
  );
  assert.deepEqual(target, { kind: "href", href: "/store?category=Pintura" });
});

test("BUG-11: 'Accesorios' matchea exacto", () => {
  const target = resolveQuickSuggestionTarget(
    { label: "Accesorios", query: "accesorios" },
    DESDEELSUR,
  );
  assert.deepEqual(target, { kind: "href", href: "/store?category=Accesorios" });
});

test("BUG-11: 'Barnices' NO existe como categoría → sigue siendo búsqueda de texto", () => {
  // Es el caso que impide "arreglar" el atajo mandándolo a una categoría inventada.
  const target = resolveQuickSuggestionTarget(
    { label: "Barnices", query: "barnices" },
    DESDEELSUR,
  );
  assert.deepEqual(target, { kind: "query", term: "barnices" });
});

test("ignora acentos y mayúsculas", () => {
  const target = resolveQuickSuggestionTarget(
    { label: "artistica", query: "artistica" },
    DESDEELSUR,
  );
  assert.deepEqual(target, { kind: "href", href: "/store?category=Art%C3%ADstica" });
});

test("plural en -es: 'Aerosoles' → Aerosoles", () => {
  const target = resolveQuickSuggestionTarget(
    { label: "Aerosoles", query: "aerosoles" },
    DESDEELSUR,
  );
  assert.deepEqual(target, { kind: "href", href: "/store?category=Aerosoles" });
});

test("NO matchea por prefijo: 'Pinceles' no puede caer en 'Pintura'", () => {
  const target = resolveQuickSuggestionTarget(
    { label: "Pinceles", query: "pinceles" },
    DESDEELSUR,
  );
  assert.deepEqual(target, { kind: "href", href: "/store?category=Pinceles" });
});

test("encuentra subcategorías", () => {
  const target = resolveQuickSuggestionTarget(
    { label: "Abrasivos", query: "abrasivos" },
    DESDEELSUR,
  );
  assert.deepEqual(target, { kind: "href", href: "/store?category=Abrasivos" });
});

test("sin categorías cargadas se comporta como antes", () => {
  const target = resolveQuickSuggestionTarget({ label: "Pinturas", query: "pinturas" });
  assert.deepEqual(target, { kind: "query", term: "pinturas" });
});

test("sin query ni match devuelve término vacío, no undefined", () => {
  const target = resolveQuickSuggestionTarget({ label: "Zzz" }, DESDEELSUR);
  assert.deepEqual(target, { kind: "query", term: "" });
});

test("un label de 1-2 letras no genera variantes que matcheen de más", () => {
  const target = resolveQuickSuggestionTarget({ label: "as", query: "as" }, [cat("A")]);
  assert.deepEqual(target, { kind: "query", term: "as" });
});
