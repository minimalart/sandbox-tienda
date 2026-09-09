"use client";

import { CheckCircleIcon, TruckIcon } from "@heroicons/react/24/outline";
import { convertToLocale } from "@lib/util/money";

type MinimumPurchaseNoticeProps = {
  compact?: boolean;
  currencyCode?: string | null;
  hasMinimumPurchase: boolean;
  progress: number;
  remaining: number;
  /**
   * Umbral configurado. Cuando es 0 o falta, la tienda no tiene mínimo — no
   * hay nada que "alcanzar", así que el aviso NO se renderiza (evita el
   * "¡Alcanzaste el mínimo!" falso positivo con carrito vacío o casi vacío).
   */
  minimumPurchaseAmount?: number;
  className?: string;
  showTopBorder?: boolean;
};

export default function MinimumPurchaseNotice({
  compact = false,
  currencyCode = "ars",
  hasMinimumPurchase,
  progress,
  remaining,
  minimumPurchaseAmount = 0,
  className,
  showTopBorder = true,
}: MinimumPurchaseNoticeProps) {
  if (minimumPurchaseAmount <= 0) return null;
  const wrapperClass = compact ? "px-4 py-3" : "px-5 py-4";
  const textClass = compact ? "text-xs" : "text-sm";
  const barClass = compact ? "h-1.5" : "h-2";

  return (
    <div
      className={`flex flex-col justify-center bg-white ${wrapperClass} ${className ?? ""}`}
      style={showTopBorder ? { borderTop: "1px solid var(--badge-bg)" } : undefined}
    >
      <div
        className={`flex items-center gap-2 ${hasMinimumPurchase ? "" : "mb-2"}`}
      >
        {hasMinimumPurchase ? (
          <CheckCircleIcon
            className={compact ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"}
            style={{ color: "var(--primary-color)" }}
          />
        ) : (
          <TruckIcon
            className={compact ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"}
            style={{ color: "var(--primary-color)" }}
          />
        )}
        <p
          className={`flex-1 font-medium ${textClass}`}
          style={{ color: "var(--tertiary-color)" }}
        >
          {hasMinimumPurchase ? (
            <span style={{ color: "var(--primary-color)" }}>
              ¡Alcanzaste el mínimo de compra!
            </span>
          ) : (
            <>
              Faltan{" "}
              <span style={{ color: "var(--primary-color)" }}>
                ${" "}
                {convertToLocale({
                  amount: remaining,
                  currency_code: currencyCode ?? "ars",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                  locale: "es-AR",
                })}
              </span>{" "}
              más para la compra mínima{" "}
              {/*
                El faltante se calcula sobre los precios CON IVA — los mismos
                que el comprador ve en la góndola y en el total del carrito
                (que ya aclara "Impuestos incluidos"). Sin decirlo, el número
                no se puede verificar contra nada: el umbral queda como un dato
                opaco y cualquier diferencia se lee como un error. Es la
                contracara del bug que reportó QA (DESDEELSUR-33, TC-001),
                donde el acumulado iba en neto y el faltante pedía un 21% de
                más — exactamente la tasa de IVA configurada en la tienda.
              */}
              <span
                className="whitespace-nowrap font-normal opacity-70"
                style={{ fontSize: "0.9em" }}
              >
                (IVA incluido)
              </span>
            </>
          )}
        </p>
      </div>
      {!hasMinimumPurchase && (
        <div
          className={`${barClass} w-full overflow-hidden rounded-full bg-green-100`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{
              background: "linear-gradient(90deg, #2e7d32 0%, #81c784 100%)",
              width: `${progress * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
