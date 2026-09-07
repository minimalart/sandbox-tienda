export type PaymentRejectionClass = 'recoverable' | 'definitive';

/** Clasificación conservadora: lo desconocido entra a dunning con backoff. */
export function classifyMercadoPagoRejection(statusDetail: string): PaymentRejectionClass {
  const detail = statusDetail.toLowerCase();
  const definitiveMarkers = [
    'bad_filled',
    'expired',
    'disabled',
    'invalid_card',
    'card_not_allowed',
    'stolen',
    'lost_card',
    'blacklist',
  ];
  return definitiveMarkers.some((marker) => detail.includes(marker))
    ? 'definitive'
    : 'recoverable';
}
