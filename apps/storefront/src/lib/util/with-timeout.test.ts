import assert from "node:assert/strict";
import { test } from "node:test";
import { withTimeout } from "./with-timeout";

test("withTimeout: una promesa que resuelve a tiempo pasa su valor tal cual", async () => {
  assert.equal(await withTimeout(Promise.resolve(42), 1000, "ok"), 42);
});

test("withTimeout: el rechazo propio de la promesa gana al timeout", async () => {
  // No se enmascara el error real: un 401 del backend tiene que llegar como 401, no
  // como "timed out".
  await assert.rejects(
    withTimeout(Promise.reject(new Error("401 del backend")), 1000, "products"),
    /401 del backend/
  );
});

test("withTimeout: el mensaje nombra QUÉ se colgó y cuánto esperó", async () => {
  // El único lugar donde este error se ve es un log de Vercel: sin el label, un
  // timeout no dice nada.
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, "sitemap: products page 3"),
    /\[sitemap: products page 3\] timed out after 10ms/
  );
});

test("withTimeout: no deja el proceso vivo esperando su propio timer", async () => {
  // `clearTimeout` en el `finally` + `unref()`: si el timer quedara colgado, el runner
  // de tests no terminaría solo. Que este archivo salga es la aserción.
  assert.equal(await withTimeout(Promise.resolve("listo"), 60_000, "largo"), "listo");
});
