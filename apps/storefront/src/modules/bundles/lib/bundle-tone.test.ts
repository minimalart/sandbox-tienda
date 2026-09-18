import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUNDLE_TONE_COUNT,
  contrastRatio,
  generateBundleTone,
  parseHex,
} from "./bundle-tone";

const PRIMARIES = [
  "#2e7d32", // verde Mercatto
  "#76B72D", // verde Desde el Sur
  "#002e5c", // azul Dorking
  "#e7691f", // naranja Depot
  "#000000",
  "#ffffff",
  "#ffe600", // amarillo: el peor caso de contraste
  "#f8bbd0", // rosa pálido
];

test("generateBundleTone: es determinística", () => {
  for (const primary of PRIMARIES) {
    for (let i = 0; i < 8; i++) {
      assert.deepEqual(generateBundleTone(primary, i), generateBundleTone(primary, i));
    }
  }
});

test("generateBundleTone: el texto cumple contraste AA sobre el fondo", () => {
  for (const primary of PRIMARIES) {
    for (let i = 0; i < BUNDLE_TONE_COUNT; i++) {
      const tone = generateBundleTone(primary, i);
      const ratio = contrastRatio(parseHex(tone.foreground)!, parseHex(tone.background)!);
      assert.ok(
        ratio >= 4.5,
        `contraste ${ratio.toFixed(2)} insuficiente para ${primary} tono ${i}`,
      );
    }
  }
});

test("generateBundleTone: el texto secundario también cumple AA", () => {
  for (const primary of PRIMARIES) {
    for (let i = 0; i < BUNDLE_TONE_COUNT; i++) {
      const tone = generateBundleTone(primary, i);
      const ratio = contrastRatio(parseHex(tone.foregroundMuted)!, parseHex(tone.background)!);
      assert.ok(ratio >= 4.5, `contraste secundario ${ratio.toFixed(2)} en ${primary}/${i}`);
    }
  }
});

test("generateBundleTone: cards contiguas no repiten tono", () => {
  for (const primary of PRIMARIES) {
    for (let i = 0; i < 20; i++) {
      const a = generateBundleTone(primary, i);
      const b = generateBundleTone(primary, i + 1);
      assert.notEqual(a.background, b.background, `tono repetido entre ${i} y ${i + 1}`);
    }
  }
});

test("generateBundleTone: la escala se repite cada BUNDLE_TONE_COUNT", () => {
  const a = generateBundleTone("#2e7d32", 1);
  const b = generateBundleTone("#2e7d32", 1 + BUNDLE_TONE_COUNT);
  assert.deepEqual(a, b);
});

test("generateBundleTone: dos tiendas con primarios distintos dan tonos distintos", () => {
  const azul = generateBundleTone("#002e5c", 0);
  const naranja = generateBundleTone("#e7691f", 0);
  assert.notEqual(azul.background, naranja.background);
});

test("generateBundleTone: hex inválido cae al neutral en vez de romper", () => {
  for (const bad of ["", "not-a-color", "#12", "#gggggg", null, undefined]) {
    const tone = generateBundleTone(bad as string, 0);
    assert.match(tone.background, /^#[0-9a-f]{6}$/);
    const ratio = contrastRatio(parseHex(tone.foreground)!, parseHex(tone.background)!);
    assert.ok(ratio >= 4.5);
  }
});

test("generateBundleTone: acepta hex de 3 dígitos y sin numeral", () => {
  assert.deepEqual(generateBundleTone("#0a0", 2), generateBundleTone("00aa00", 2));
});

test("generateBundleTone: índices raros no rompen la escala", () => {
  for (const index of [-3, 0, 1.7, 999999, Number.NaN]) {
    const tone = generateBundleTone("#2e7d32", index);
    assert.ok(tone.toneIndex >= 0 && tone.toneIndex < BUNDLE_TONE_COUNT);
  }
});

test("generateBundleTone: el hover es más oscuro que el fondo", () => {
  for (const primary of PRIMARIES) {
    const tone = generateBundleTone(primary, 0);
    const bg = parseHex(tone.background)!;
    const hover = parseHex(tone.backgroundHover)!;
    const sum = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;
    assert.ok(sum(hover) <= sum(bg), `hover no oscurece para ${primary}`);
  }
});
