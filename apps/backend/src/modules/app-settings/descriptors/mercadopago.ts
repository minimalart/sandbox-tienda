import { defineSettings } from './types';

/** One encrypted instance account/map shared by both payment providers. */
export default defineSettings({
  namespace: 'extension:mercadopago',
  title: 'Mercado Pago',
  defaultScope: 'instance',
  settings: [
    {
      key: 'MERCADOPAGO_ENABLED',
      env: ['MERCADOPAGO_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Operación',
      label: 'Checkout Pro activo',
      default: false,
    },
    {
      key: 'MERCADOPAGO_API_ENABLED',
      env: ['MERCADOPAGO_API_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Operación',
      label: 'Checkout API activo',
      default: false,
    },
    {
      key: 'MERCADOPAGO_ACCESS_TOKEN',
      env: ['MERCADOPAGO_ACCESS_TOKEN'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Access token',
    },
    {
      key: 'MERCADOPAGO_PUBLIC_KEY',
      env: ['MERCADOPAGO_PUBLIC_KEY'],
      type: 'string',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Public key',
    },
    {
      key: 'MERCADOPAGO_WEBHOOK_SECRET',
      env: ['MERCADOPAGO_WEBHOOK_SECRET'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Secreto del webhook',
    },
    {
      key: 'MERCADOPAGO_ACCOUNTS',
      env: ['MERCADOPAGO_ACCOUNTS'],
      type: 'secret',
      tier: 'runtime',
      group: 'Credenciales',
      label: 'Cuentas por tienda o sucursal (JSON)',
      help: 'Mapa de cuentas por identificador de tienda, sucursal o canal. Cada cuenta incluye accessToken y puede incluir publicKey y webhookSecret.',
      refine: (value) => {
        if (!value) return null;
        try {
          const map = JSON.parse(String(value));
          if (!map || typeof map !== 'object' || Array.isArray(map))
            return 'Ingresá un objeto JSON de cuentas.';
          for (const account of Object.values(map)) {
            if (
              !account ||
              typeof account !== 'object' ||
              typeof (
                (account as Record<string, unknown>).accessToken ??
                (account as Record<string, unknown>).access_token
              ) !== 'string'
            )
              return 'Cada cuenta necesita un accessToken.';
          }
          return null;
        } catch {
          return 'El mapa de cuentas debe ser JSON válido.';
        }
      },
    },
  ],
});
