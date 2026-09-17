"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSiteHref, useTenantBrand } from "@lib/site-config/context";
import type { StorefrontBundleDetail } from "@lib/data/bundles";
import { confirmBundle, reconfigureBundle } from "@lib/data/bundles";
import { ensureCart } from "../actions/ensure-cart";
import { useBundleWizard } from "../hooks/use-bundle-wizard";
import { formatPrice } from "../lib/resolve-variant";
import type { BundleEnrichment } from "../lib/variant-presentation";
import { BundleReview } from "./bundle-review";
import { BundleStep } from "./bundle-step";

/**
 * Shell del wizard. Estados (PRD §57): start · step · review · error.
 *
 * Loading / bundle-not-found los resuelve el server component que lo renderiza.
 * Los errores de catálogo o variante no disponible llegan por la mutación
 * `confirm` y dejan al cliente en `error` con el mensaje del servidor.
 *
 * La maqueta ocupa la ventana COMPLETA (`fixed inset-0`) y se reparte en tres
 * filas fijas: navegación + progreso arriba, la pregunta al medio y la acción
 * abajo. Es deliberado: en desktop el paso tiene que entrar entero sin scroll
 * — ni vertical ni horizontal — porque scrollear para ver la última opción o
 * el botón rompe la lectura de "elegí una de estas". En mobile la columna
 * central sí puede scrollear, que es la única forma de que entren las fotos.
 *
 * Los acentos salen de `--primary-color` (el color del tenant), no de negros
 * fijos, para que cada tienda se vea como ella misma.
 */
export const BundleWizard = ({
  bundle,
  cartId,
  countryCode,
  enrichment = {},
  editInstanceId = null,
  initialSelections,
}: {
  bundle: StorefrontBundleDetail;
  cartId: string | null;
  countryCode: string;
  enrichment?: BundleEnrichment;
  /**
   * Cuando viene con valor, el wizard está en modo EDIT y va a llamar
   * `reconfigureBundle()` en el confirm — reemplaza los line items de esa
   * instancia preservando el instance_id. El page es el responsable de
   * derivarlo de `?instance=` en la URL y de validar que corresponda a un
   * line item existente del cart.
   */
  editInstanceId?: string | null;
  /**
   * Mapa `bundle_item_id → variant_id` con los variants ya elegidos en la
   * instancia que se está editando. El hook los hidrata como estado inicial
   * y el operador puede cambiar sólo los que quiera. Ignorado cuando
   * `editInstanceId` es null.
   */
  initialSelections?: Record<string, string>;
}) => {
  const router = useRouter();
  // `useSiteHref` y no un path a mano: desde /tienda/{slug}/... un push a
  // "/checkout" pelado sale de la tienda hija y cae en el sitio principal.
  const siteHref = useSiteHref();
  const { name: brandName, logos } = useTenantBrand();
  const autoResolved = useMemo(
    () =>
      bundle.items
        .filter((i) => i.auto_resolved_variant_id)
        .map((i) => ({ bundle_item_id: i.id, variant_id: i.auto_resolved_variant_id! })),
    [bundle.items],
  );
  const configurable = useMemo(
    () => bundle.items.filter((i) => !i.auto_resolved_variant_id),
    [bundle.items],
  );
  const configurableIds = useMemo(() => configurable.map((i) => i.id), [configurable]);

  const [phase, setPhase] = useState<"start" | "step" | "review" | "error">("start");
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const { selections, currentStep, selectVariant, goToStep, allSelected } = useBundleWizard({
    bundleId: bundle.id,
    cartId,
    autoResolvedItems: autoResolved,
    configurableItemIds: configurableIds,
    initialSelections,
  });
  const isEdit = !!editInstanceId;

  /** Total en vivo de lo elegido hasta ahora (incluye los ítems auto-resueltos). */
  const running = useMemo(() => {
    let amount = 0;
    let currency: string | null = null;
    let complete = true;
    for (const item of bundle.items) {
      const variantId = selections[item.id] ?? item.auto_resolved_variant_id;
      const variant = item.product?.variants.find((v) => v.id === variantId) ?? null;
      const price = variant?.calculated_price;
      if (!price) {
        complete = false;
        continue;
      }
      currency ??= price.currency_code;
      if (price.currency_code !== currency) complete = false;
      amount += price.amount * item.quantity;
    }
    return { amount, currency, complete };
  }, [bundle.items, selections]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      // El visitante llega por link, casi siempre sin carrito: lo creamos acá en
      // vez de exigirlo (antes el kit terminado moría con "Necesitás un carrito
      // activo", que además no le decía a nadie qué hacer).
      const activeCartId = cartId ?? (await ensureCart(countryCode));
      const payload = {
        bundle_id: bundle.id,
        cart_id: activeCartId,
        selections: bundle.items.map((item) => ({
          bundle_item_id: item.id,
          variant_id: (selections[item.id] ?? item.auto_resolved_variant_id ?? "") as string,
        })),
      };
      // Fail fast client-side también: si algún ítem quedó sin selección
      // cortamos antes de pegarle al servidor (el wizard no debería permitirlo,
      // pero vale como red defensiva).
      if (payload.selections.some((s) => !s.variant_id)) {
        throw new Error("Faltan opciones por elegir.");
      }
      if (isEdit && editInstanceId) {
        // Reconfigure: reemplaza atómicamente los line items de la instancia,
        // preservando `bundle_instance_id` — nada de bundle duplicado en el
        // carrito. Backend: reconfigureBundleWorkflow (add nuevos, si succeed
        // borra viejos; rollback en failure del add). Editar viene desde
        // /cart así que devolvemos ahí — no colar al checkout un flow de
        // edición que puede ir y venir varias veces.
        await reconfigureBundle({ ...payload, bundle_instance_id: editInstanceId });
        router.push(siteHref("/cart"));
      } else {
        await confirmBundle(payload);
        // Directo al checkout: el kit ya está armado y revisado; pasar por
        // el carrito sólo agrega un paso para volver a mirar lo mismo.
        router.push(siteHref("/checkout"));
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    } finally {
      setIsConfirming(false);
    }
  };

  const exit = () => router.push(siteHref("/"));

  if (phase === "error") {
    return (
      <Shell onCancel={exit}>
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-800">{error ?? "Se produjo un error al procesar el kit."}</p>
          <button
            type="button"
            className="text-sm font-medium text-red-900 underline underline-offset-4"
            onClick={() => {
              setError(null);
              setPhase(configurableIds.length ? "step" : "review");
            }}
          >
            Volver al kit
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "start") {
    return (
      // Sin "onCancel" en el Shell: en esta pantalla el botón va pegado abajo
      // de "Empezar", no al pie de la ventana.
      <Shell>
        <div className="mx-auto max-w-xl space-y-6 text-center">
          {/* El wizard tapa el header del sitio (es pantalla completa), así que
              la marca tiene que aparecer acá: si no, el visitante que llega por
              un link compartido no sabe en qué tienda está comprando. */}
          {logos?.main && (
            <img
              src={logos.main}
              alt={brandName}
              className="mx-auto h-10 w-auto object-contain"
            />
          )}
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">Armá tu kit</p>
          <h1 className="text-3xl font-medium tracking-tight text-neutral-900 xl:text-[40px] xl:leading-[1.15]">
            {bundle.title}
          </h1>
          <p className="text-sm leading-relaxed text-neutral-500">
            Te vamos a hacer {configurableIds.length || bundle.items.length}{" "}
            {configurableIds.length === 1 ? "pregunta" : "preguntas"}, una por producto de la lista.
            {autoResolved.length > 0 && (
              <> Ya resolvimos {autoResolved.length} que tienen una sola opción.</>
            )}{" "}
            En cada una podés comparar precios y ver el detalle antes de elegir.
          </p>

          <dl className="mx-auto flex max-w-md justify-center divide-x divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
            <Stat label="Productos" value={String(bundle.items.length)} />
            <Stat label="A elegir" value={String(configurableIds.length)} />
            {bundle.pricing.from && (
              <Stat
                label="Desde"
                value={formatPrice(bundle.pricing.from.amount, bundle.pricing.from.currency_code)}
              />
            )}
          </dl>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-[--primary-color] px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[--primary-color-dark]"
            onClick={() => setPhase(configurableIds.length ? "step" : "review")}
          >
            Empezar <span aria-hidden>→</span>
          </button>

          <div>
            <button
              type="button"
              onClick={exit}
              className="text-xs uppercase tracking-[0.18em] text-red-600 transition-colors hover:text-red-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "step") {
    const item = configurable[currentStep];
    if (!item) {
      setPhase("review");
      return null;
    }
    const total = configurable.length;
    const isLast = currentStep + 1 >= total;
    const chosen = selections[item.id] ?? null;

    return (
      <Shell
        onBack={
          currentStep === 0 ? () => setPhase("start") : () => goToStep(Math.max(0, currentStep - 1))
        }
        onCancel={exit}
        progress={{ current: currentStep + 1, total }}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400 sm:text-[11px]">
                Total del kit
              </p>
              <p className="text-lg font-semibold leading-tight text-neutral-900">
                {running.currency ? formatPrice(running.amount, running.currency) : "—"}
                {!running.complete && (
                  <span className="ml-2 text-xs font-normal text-neutral-400">
                    faltan opciones
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {allSelected && !isLast && (
                <button
                  type="button"
                  onClick={() => setPhase("review")}
                  className="text-xs text-neutral-500 underline underline-offset-4"
                >
                  Ir a revisar
                </button>
              )}
              <button
                type="button"
                className="rounded-full bg-[--primary-color] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[--primary-color-dark] disabled:cursor-not-allowed disabled:opacity-40 sm:px-8"
                disabled={!chosen}
                onClick={() => (isLast ? setPhase("review") : goToStep(currentStep + 1))}
              >
                {isLast ? "Revisar mi kit" : "Continuar"} <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        }
      >
        <BundleStep
          item={item}
          currentVariantId={chosen}
          enrichment={enrichment[item.product_id]}
          onChange={(variantId) => selectVariant(item.id, variantId)}
        />
      </Shell>
    );
  }

  return (
    <Shell
      onBack={() => setPhase(configurableIds.length ? "step" : "start")}
      onCancel={exit}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400 sm:text-[11px]">Total del kit</p>
            <p className="text-lg font-semibold leading-tight text-neutral-900">
              {running.currency ? formatPrice(running.amount, running.currency) : "—"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-[--primary-color] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[--primary-color-dark] disabled:opacity-50 sm:px-8"
            onClick={handleConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? "Agregando…" : "Agregar el kit al carrito"}
          </button>
        </div>
      }
    >
      <BundleReview
        bundle={bundle}
        selections={selections}
        enrichment={enrichment}
        onEditItem={(itemId) => {
          const idx = configurable.findIndex((i) => i.id === itemId);
          if (idx >= 0) {
            goToStep(idx);
            setPhase("step");
          }
        }}
      />
    </Shell>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex-1 px-4 py-3">
    <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-400">{label}</dt>
    <dd className="text-sm font-medium text-neutral-900">{value}</dd>
  </div>
);

/**
 * Marco de pantalla completa: navegación + progreso (fila fija), contenido
 * centrado (fila elástica) y acción (fila fija). `min-h-0` en la fila del medio
 * es lo que evita que el flex la empuje más allá del viewport — sin eso, el
 * contenido crece y vuelve el scroll de página que queremos evitar.
 */
const Shell = ({
  children,
  onBack,
  onCancel,
  progress,
  footer,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  onCancel?: () => void;
  progress?: { current: number; total: number };
  footer?: React.ReactNode;
}) => (
  <div className="fixed inset-0 z-[1001] flex flex-col bg-white">
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-4 py-4 sm:px-8">
      <div className="flex shrink-0 items-center justify-between text-xs uppercase tracking-[0.18em] text-neutral-400">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 transition-colors hover:text-neutral-700"
          >
            <span aria-hidden>←</span> Atrás
          </button>
        ) : (
          <span />
        )}
        {progress && (
          <span className="text-neutral-400">
            {progress.current} / {progress.total}
          </span>
        )}
        <span />
      </div>

      {progress && (
        <div className="mt-4 h-px w-full shrink-0 bg-neutral-200">
          <div
            className="h-px bg-[--primary-color] transition-all duration-500"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}

      {/* `m-auto` y no `justify-center`: centrar con flex recorta el tope del
          contenido cuando no entra (el scroll no llega a lo que quedó arriba).
          Con margen auto se centra si sobra lugar y se apoya arriba si falta. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-3 sm:py-4 lg:overflow-hidden">
        <div className="m-auto w-full">{children}</div>
      </div>

      {footer && <div className="shrink-0 border-t border-neutral-200 pt-4">{footer}</div>}

      {/* Cancelar vive DEBAJO de la acción principal y en rojo: es la salida del
          flujo, no una acción de navegación. Arriba a la derecha competía con
          "Atrás" y se tocaba por error. */}
      {onCancel && (
        <div className="shrink-0 pt-3 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs uppercase tracking-[0.18em] text-red-600 transition-colors hover:text-red-700"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  </div>
);
