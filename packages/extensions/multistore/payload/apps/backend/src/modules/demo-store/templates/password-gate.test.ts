import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTenantConfig } from './index.ts';
import type { DemoStoreLike } from './types.ts';

/**
 * `buildTenantConfig` alimenta GET /store/demo-stores/{slug}/config, que es
 * PÚBLICO. La página de contraseña sólo puede publicar `{ enabled, length }`:
 * si la palabra se filtrara ahí, cualquiera podría leerla pegándole al endpoint.
 */
/**
 * 7 caracteres a propósito: más que el máximo actual (6). `buildTenantConfig` no
 * valida el largo, sólo publica el de lo que está guardado — así una palabra
 * grabada cuando el tope era 12 sigue dibujando sus casillas en vez de dejar el
 * sitio abierto.
 */
const PASSWORD = 'clave12';

const demo = (over: Partial<DemoStoreLike> = {}): DemoStoreLike => ({
  id: 'demo_1',
  name: 'Tienda Linda',
  slug: 'tienda-linda',
  template_code: 'supermercado',
  country_code: 'ar',
  currency_code: 'ars',
  locale: 'es',
  sales_channel_id: 'sc_demo',
  ...over,
});

describe('buildTenantConfig · página de contraseña', () => {
  it('publica enabled + length cuando la demo tiene el gate activo', () => {
    const config = buildTenantConfig(
      demo({ password_gate_enabled: true, password_gate_password: PASSWORD }),
    );
    assert.deepEqual(config.medusa.passwordGate, { enabled: true, length: PASSWORD.length });
  });

  it('NO filtra la palabra en ninguna parte del payload público', () => {
    const config = buildTenantConfig(
      demo({ password_gate_enabled: true, password_gate_password: PASSWORD }),
    );
    assert.equal(JSON.stringify(config).includes(PASSWORD), false);
  });

  it('gate apagado → la clave no aparece en el config', () => {
    const config = buildTenantConfig(
      demo({ password_gate_enabled: false, password_gate_password: PASSWORD }),
    );
    assert.equal(config.medusa.passwordGate, undefined);
  });

  it('activo pero sin palabra guardada → no se publica el gate', () => {
    const config = buildTenantConfig(
      demo({ password_gate_enabled: true, password_gate_password: null }),
    );
    assert.equal(config.medusa.passwordGate, undefined);
  });

  it('una demo sin la config (columnas nuevas ausentes) no publica el gate', () => {
    assert.equal(buildTenantConfig(demo()).medusa.passwordGate, undefined);
  });
});
