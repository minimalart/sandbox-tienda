import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPromotionsGateFailure,
  resolvePromotionsGate,
} from "./promotions-gate";

const CHANNEL = "sc_01KZVX8WMP1SGPH0GZP28VVZ6X";

describe("resolvePromotionsGate", () => {
  it("con promociones activas se muestra el acceso", () => {
    assert.deepEqual(
      resolvePromotionsGate({
        salesChannelId: CHANNEL,
        hasAdminApiKey: true,
        activePromotionIds: ["promo_01", "promo_02"],
      }),
      { accessVisible: true, reason: null },
    );
  });

  it("sin promociones activas se esconde: la PLP filtrada saldría vacía", () => {
    assert.deepEqual(
      resolvePromotionsGate({
        salesChannelId: CHANNEL,
        hasAdminApiKey: true,
        activePromotionIds: [],
      }),
      { accessVisible: false, reason: "no-active-promotions" },
    );
  });

  /**
   * El caso de desdeelsur el 2026-09-01 (DESDEELSUR-30): canal resuelto, CERO
   * promociones en el back y la consulta al Admin API reventando. El gate
   * contestaba `true` por fail-open y la card del menú mobile quedaba prendida
   * ofreciendo descuentos que no existían.
   */
  it("si la consulta falla NO se muestra: no saber no es saber que sí", () => {
    assert.deepEqual(
      resolvePromotionsGate({
        salesChannelId: CHANNEL,
        hasAdminApiKey: true,
        activePromotionIds: null,
      }),
      { accessVisible: false, reason: "lookup-failed" },
    );
  });

  /**
   * La lista sale del Admin API. Sin clave la consulta ni se intenta: el 401 no
   * agrega información y se repetiría en cada render.
   */
  it("sin MEDUSA_ADMIN_API_KEY tampoco se muestra", () => {
    assert.deepEqual(
      resolvePromotionsGate({
        salesChannelId: CHANNEL,
        hasAdminApiKey: false,
        activePromotionIds: null,
      }),
      { accessVisible: false, reason: "no-admin-api-key" },
    );
  });

  it("sin canal de ventas no hay a quién preguntarle", () => {
    for (const salesChannelId of [undefined, null, ""]) {
      assert.deepEqual(
        resolvePromotionsGate({
          salesChannelId,
          hasAdminApiKey: true,
          activePromotionIds: ["promo_01"],
        }),
        { accessVisible: false, reason: "no-sales-channel" },
        `salesChannelId=${JSON.stringify(salesChannelId)}`,
      );
    }
  });

  it("la falta de canal gana sobre la falta de clave", () => {
    assert.equal(
      resolvePromotionsGate({
        salesChannelId: null,
        hasAdminApiKey: false,
        activePromotionIds: null,
      }).reason,
      "no-sales-channel",
    );
  });
});

describe("isPromotionsGateFailure", () => {
  it("sólo los estados de mala configuración o backend caído se loguean", () => {
    assert.equal(isPromotionsGateFailure("no-admin-api-key"), true);
    assert.equal(isPromotionsGateFailure("lookup-failed"), true);
  });

  it("no tener promociones es un estado legítimo, no un error", () => {
    assert.equal(isPromotionsGateFailure("no-active-promotions"), false);
    assert.equal(isPromotionsGateFailure("no-sales-channel"), false);
    assert.equal(isPromotionsGateFailure(null), false);
  });
});
