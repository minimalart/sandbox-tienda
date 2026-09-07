/**
 * Bridge between the checkout UI and the embedded MercadoPago Checkout API Brick.
 *
 * The Brick renders with its native pay button hidden
 * (`customization.visual.hidePaymentButton = true`). Two external actions drive
 * it, both via MP's `window.paymentBrickController.getFormData()`:
 *
 *  - `validate` ("Confirmar datos de pago" in the payment step): validates the
 *    form (MP highlights missing fields). Used to gate the session creation so
 *    "Finalizar compra" only enables once the data is loaded.
 *  - `submit` ("Finalizar compra" in the summary): re-reads the tokenized form
 *    data, POSTs the payment and redirects to /checkout/success.
 *
 * Only one Brick is mounted at a time (a single checkout step), so module-scoped
 * slots are enough. The Brick registers on mount and clears on unmount.
 */
type MpApiHandler = () => Promise<boolean>;

let currentSubmit: MpApiHandler | null = null;
let currentValidate: MpApiHandler | null = null;

export function registerMpApiSubmit(fn: MpApiHandler | null): void {
  currentSubmit = fn;
}

export function registerMpApiValidate(fn: MpApiHandler | null): void {
  currentValidate = fn;
}

/**
 * Triggers the mounted Brick's submit. Returns true if it initiated navigation
 * (payment accepted → redirect), false when no Brick is mounted or the form is
 * invalid/failed (the Brick surfaces the error itself).
 */
export async function submitMpApiBrick(): Promise<boolean> {
  if (!currentSubmit) return false;
  return currentSubmit();
}

/**
 * Validates the mounted Brick's form without paying. Returns true when the form
 * is complete/valid, false when it's incomplete (the Brick highlights the
 * fields) or no Brick is mounted.
 */
export async function validateMpApiBrick(): Promise<boolean> {
  if (!currentValidate) return false;
  return currentValidate();
}
