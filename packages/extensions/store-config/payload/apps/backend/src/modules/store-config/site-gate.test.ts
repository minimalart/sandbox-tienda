import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGateToken,
  demoSlugFromScope,
  listGateSites,
  passwordMatches,
  resolveGatePassword,
  saveGateSite,
  tokenMatches,
} from './site-gate.ts';

const STORE_CONFIG_MODULE = 'storeConfig';
const DEMO_STORE_MODULE = 'demo_store';

type FakeDemo = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  /** La fila de la tienda principal. Su gate vive en el scope `store`, no acá. */
  is_main?: boolean;
  password_gate_enabled?: boolean;
  password_gate_password?: string | null;
};

/**
 * Contenedor falso: `resolve` devuelve el servicio pedido y tira si no está
 * registrado, igual que el container de Medusa. Sin `demos` se simula un
 * proyecto sin el módulo de demos instalado.
 */
const makeContainer = (options: {
  storeGate?: { enabled: boolean; password: string };
  demos?: FakeDemo[] | null;
}) => {
  const updates: Record<string, unknown>[] = [];
  const storeGate = options.storeGate ?? { enabled: false, password: '' };
  const upserts: Record<string, unknown>[] = [];

  const storeConfigService = {
    getPasswordGate: async () => storeGate,
    upsertPasswordGate: async (value: { enabled?: boolean; password?: string }) => {
      upserts.push(value);
      const password = (value.password ?? storeGate.password).trim();
      // Igual que el servicio real: al ESCRIBIR se exige el rango completo (4-6).
      const usable = password.length >= 4 && password.length <= 6 && !/\s/.test(password);
      return {
        enabled: usable && (value.enabled ?? storeGate.enabled) === true,
        password: usable ? password : '',
      };
    },
  };

  const demoService =
    options.demos === null || options.demos === undefined
      ? null
      : {
          listDemoStores: async (filter: { slug?: string; status?: string }) =>
            (options.demos as FakeDemo[]).filter(
              (d) =>
                (filter.slug === undefined || d.slug === filter.slug) &&
                (filter.status === undefined || (d.status ?? 'ready') === filter.status),
            ),
          updateDemoStores: async (input: Record<string, unknown>) => {
            updates.push(input);
            return input;
          },
        };

  return {
    updates,
    upserts,
    container: {
      resolve: (key: string) => {
        if (key === STORE_CONFIG_MODULE) return storeConfigService;
        if (key === DEMO_STORE_MODULE) {
          if (!demoService) throw new Error('module not registered');
          return demoService;
        }
        throw new Error(`unknown ${key}`);
      },
    },
  };
};

const demo = (over: Partial<FakeDemo> = {}): FakeDemo => ({
  id: 'demo_1',
  name: 'Tienda Linda',
  slug: 'tienda-linda',
  status: 'ready',
  password_gate_enabled: true,
  password_gate_password: 'clave1',
  ...over,
});

/** Palabra guardada cuando el máximo era 12: al leer sigue valiendo. */
const LEGACY_PASSWORD = 'lanzamiento26';

describe('siteSlugFromScope', () => {
  it('extrae el slug del scope nuevo', () => {
    assert.equal(demoSlugFromScope('site:tienda-linda'), 'tienda-linda');
  });

  it('SIGUE aceptando el scope legacy `demo:` — hay tokens vivos con él', () => {
    // El scope es entrada del HMAC (`buildGateToken` hashea `${scope}:${password}`),
    // así que toda cookie `_site_gate` en un browser fue calculada con `demo:`.
    // Rechazarlo dejaría afuera a cada visitante que ya acertó la contraseña.
    assert.equal(demoSlugFromScope('demo:tienda-linda'), 'tienda-linda');
  });

  it('la tienda principal no es una tienda por slug', () => {
    assert.equal(demoSlugFromScope('store'), null);
  });

  it('un scope sin slug no resuelve, con ninguno de los dos prefijos', () => {
    assert.equal(demoSlugFromScope('site:'), null);
    assert.equal(demoSlugFromScope('demo:'), null);
  });

  it('un prefijo desconocido no resuelve', () => {
    assert.equal(demoSlugFromScope('tienda:moda'), null);
    assert.equal(demoSlugFromScope('moda'), null);
  });
});

describe('el scope es entrada del HMAC: renombrarlo invalida los tokens', () => {
  it('el mismo slug y la misma palabra dan tokens DISTINTOS según el prefijo', () => {
    // Esto documenta por qué hace falta la doble verificación en el storefront, y por
    // qué el fallback no se puede borrar el mismo día que se shipea el rename.
    const conNuevo = buildGateToken('site:moda', 'clave1');
    const conLegacy = buildGateToken('demo:moda', 'clave1');
    assert.notEqual(
      conNuevo,
      conLegacy,
      'si fueran iguales el rename sería gratis; no lo es, y de ahí el fallback',
    );
  });
});

describe('buildGateToken', () => {
  it('es determinístico para el mismo scope y palabra', () => {
    assert.equal(buildGateToken('store', 'demo2026'), buildGateToken('store', 'demo2026'));
  });

  it('ignora mayúsculas (se compara case-insensitive)', () => {
    assert.equal(buildGateToken('store', 'Demo2026'), buildGateToken('store', 'demo2026'));
  });

  it('el token de un sitio no sirve en otro', () => {
    assert.notEqual(
      buildGateToken('demo:uno', 'demo2026'),
      buildGateToken('demo:dos', 'demo2026'),
    );
  });

  it('cambiar la palabra invalida el token anterior', () => {
    assert.notEqual(buildGateToken('store', 'demo2026'), buildGateToken('store', 'demo2027'));
  });
});

describe('tokenMatches', () => {
  const token = buildGateToken('store', 'demo2026');

  it('acepta el token correcto', () => {
    assert.equal(tokenMatches(token, token), true);
  });

  it('rechaza uno distinto del mismo largo', () => {
    assert.equal(tokenMatches(token, 'a'.repeat(token.length)), false);
  });

  it('rechaza otros largos y valores no string sin explotar', () => {
    assert.equal(tokenMatches(token, 'corto'), false);
    assert.equal(tokenMatches(token, undefined), false);
    assert.equal(tokenMatches(token, 12345), false);
  });
});

describe('passwordMatches', () => {
  it('acepta la palabra sin importar mayúsculas ni espacios al borde', () => {
    assert.equal(passwordMatches('demo2026', '  DEMO2026 '), true);
  });

  it('rechaza otra palabra', () => {
    assert.equal(passwordMatches('demo2026', 'demo2027'), false);
  });

  it('nunca acepta vacío (ni contra una esperada vacía)', () => {
    assert.equal(passwordMatches('demo2026', ''), false);
    assert.equal(passwordMatches('', ''), false);
  });
});

describe('resolveGatePassword', () => {
  it('devuelve la palabra de la tienda principal cuando el gate está activo', async () => {
    const { container } = makeContainer({ storeGate: { enabled: true, password: 'demo26' } });
    assert.equal(await resolveGatePassword(container, 'store'), 'demo26');
  });

  it('gate apagado en la tienda principal → sin palabra', async () => {
    const { container } = makeContainer({ storeGate: { enabled: false, password: 'demo26' } });
    assert.equal(await resolveGatePassword(container, 'store'), '');
  });

  it('devuelve la palabra de la demo', async () => {
    const { container } = makeContainer({ demos: [demo()] });
    assert.equal(await resolveGatePassword(container, 'demo:tienda-linda'), 'clave1');
  });

  it('demo con el gate apagado → sin palabra', async () => {
    const { container } = makeContainer({ demos: [demo({ password_gate_enabled: false })] });
    assert.equal(await resolveGatePassword(container, 'demo:tienda-linda'), '');
  });

  it('demo con palabra fuera de rango → sin palabra (no se puede activar)', async () => {
    const { container } = makeContainer({ demos: [demo({ password_gate_password: 'ab' })] });
    assert.equal(await resolveGatePassword(container, 'demo:tienda-linda'), '');
  });

  it('demo inexistente → sin palabra', async () => {
    const { container } = makeContainer({ demos: [demo()] });
    assert.equal(await resolveGatePassword(container, 'demo:otra'), '');
  });

  it('sin el módulo de demos instalado no rompe', async () => {
    const { container } = makeContainer({ demos: null });
    assert.equal(await resolveGatePassword(container, 'demo:tienda-linda'), '');
  });

  it('un scope desconocido no resuelve nada', async () => {
    const { container } = makeContainer({ storeGate: { enabled: true, password: 'demo26' } });
    assert.equal(await resolveGatePassword(container, 'cualquiera'), '');
  });
});

describe('listGateSites', () => {
  it('siempre lista la tienda principal', async () => {
    const { container } = makeContainer({ demos: null });
    const sites = await listGateSites(container);
    assert.equal(sites.length, 1);
    assert.deepEqual(
      { scope: sites[0]?.scope, path: sites[0]?.path },
      { scope: 'store', path: '/' },
    );
  });

  it('agrega una fila por demo, con su ruta pública', async () => {
    const { container } = makeContainer({
      storeGate: { enabled: true, password: 'demo26' },
      demos: [demo()],
    });
    const sites = await listGateSites(container);
    assert.deepEqual(
      sites.map((s) => s.scope),
      ['store', 'site:tienda-linda'],
    );
    assert.equal(sites[1]?.path, '/tienda/tienda-linda');
    assert.equal(sites[1]?.demo_id, 'demo_1');
    assert.equal(sites[1]?.enabled, true);
  });

  it('una demo con palabra inválida se reporta apagada', async () => {
    const { container } = makeContainer({ demos: [demo({ password_gate_password: 'ab' })] });
    const sites = await listGateSites(container);
    assert.equal(sites[1]?.enabled, false);
    assert.equal(sites[1]?.password, '');
  });

  it('muestra una palabra más larga que el máximo actual para poder acortarla', async () => {
    const { container } = makeContainer({
      demos: [demo({ password_gate_password: LEGACY_PASSWORD })],
    });
    const sites = await listGateSites(container);
    assert.equal(sites[1]?.password, LEGACY_PASSWORD);
    assert.equal(sites[1]?.enabled, true);
  });

  it('la fila principal NO se duplica: ya está como la fila sintética "store"', async () => {
    // Mina #2 del plan. La principal es una fila real de demo_store, así que el loop
    // de tiendas la encuentra. Sin el `continue`, la pestaña Acceso mostraría
    // "Mercatto" DOS veces y la segunda escribiría a las columnas planas en vez del
    // setting `password_gate` — la UI leería la fuente que no se escribió.
    const { container } = makeContainer({
      demos: [
        demo({ id: 'demo_main', slug: 'principal', name: 'Mercatto', is_main: true }),
        demo(),
      ],
    });
    const sites = await listGateSites(container);
    assert.deepEqual(
      sites.map((s) => s.scope),
      ['store', 'site:tienda-linda'],
      'la principal sólo puede aparecer una vez, con scope "store"',
    );
    assert.equal(
      sites.filter((s) => s.label === 'Mercatto').length,
      0,
      'la fila principal se saltea: su label es "Tienda principal", el de la sintética',
    );
  });
});

describe('saveGateSite', () => {
  it('guarda el gate de la tienda principal en el setting', async () => {
    const { container, upserts } = makeContainer({});
    const site = await saveGateSite(container, {
      scope: 'store',
      enabled: true,
      password: 'demo26',
    });
    assert.deepEqual(upserts, [{ enabled: true, password: 'demo26' }]);
    assert.equal(site.enabled, true);
    assert.equal(site.scope, 'store');
  });

  it('guarda el gate de una demo en columnas planas, sin tocar content_config', async () => {
    const { container, updates } = makeContainer({
      demos: [demo({ password_gate_enabled: false, password_gate_password: null })],
    });
    const site = await saveGateSite(container, {
      scope: 'demo:tienda-linda',
      enabled: true,
      password: 'clave1',
    });
    assert.deepEqual(updates, [
      { id: 'demo_1', password_gate_enabled: true, password_gate_password: 'clave1' },
    ]);
    assert.ok(!('content_config' in (updates[0] as object)));
    assert.equal(site.enabled, true);
  });

  it('sin palabra usable el gate queda apagado (no encierra a nadie)', async () => {
    const { container, updates } = makeContainer({ demos: [demo()] });
    await saveGateSite(container, { scope: 'demo:tienda-linda', enabled: true, password: 'ab' });
    assert.deepEqual(updates, [
      { id: 'demo_1', password_gate_enabled: false, password_gate_password: null },
    ]);
  });

  it('apagar el switch conserva la palabra guardada', async () => {
    const { container, updates } = makeContainer({ demos: [demo()] });
    await saveGateSite(container, { scope: 'demo:tienda-linda', enabled: false });
    assert.deepEqual(updates, [
      { id: 'demo_1', password_gate_enabled: false, password_gate_password: 'clave1' },
    ]);
  });

  it('una demo inexistente falla explícitamente', async () => {
    const { container } = makeContainer({ demos: [demo()] });
    await assert.rejects(() => saveGateSite(container, { scope: 'demo:otra', enabled: true }));
  });

  it('la fila principal NO se escribe por slug: su gate va al scope "store"', async () => {
    // Sin este guard habría DOS fuentes de verdad para el mismo gate: el setting
    // `password_gate` (que es el que lee la UI) y las columnas planas de la fila. La
    // pantalla escribiría una y leería la otra.
    const { container, updates } = makeContainer({
      demos: [demo({ id: 'demo_main', slug: 'principal', name: 'Mercatto', is_main: true })],
    });
    await assert.rejects(
      () => saveGateSite(container, { scope: 'demo:principal', enabled: true, password: 'clave1' }),
      /scope "store"/,
    );
    assert.deepEqual(updates, [], 'no debe escribir las columnas planas de la principal');
  });

  it('sin el módulo de demos, guardar una demo falla explícitamente', async () => {
    const { container } = makeContainer({ demos: null });
    await assert.rejects(() =>
      saveGateSite(container, { scope: 'demo:tienda-linda', enabled: true }),
    );
  });

  it('un scope desconocido falla', async () => {
    const { container } = makeContainer({});
    await assert.rejects(() => saveGateSite(container, { scope: 'nope', enabled: true }));
  });
});

/**
 * El máximo bajó de 12 a 6 cuando ya había gates activos. Estos casos son el
 * seguro de que ese cambio no puede apagar un gate por su cuenta: si lo apagara,
 * el sitio quedaría ABIERTO al público sin que nadie toque nada.
 */
describe('palabras guardadas antes de que bajara el máximo', () => {
  it('siguen desbloqueando el sitio (lectura sin tope de largo)', async () => {
    const { container } = makeContainer({
      demos: [demo({ password_gate_password: LEGACY_PASSWORD })],
    });
    assert.equal(
      await resolveGatePassword(container, 'demo:tienda-linda'),
      LEGACY_PASSWORD,
    );
  });

  it('mover el switch sin tocar la palabra no la borra', async () => {
    const { container, updates } = makeContainer({
      demos: [demo({ password_gate_password: LEGACY_PASSWORD })],
    });
    await saveGateSite(container, { scope: 'demo:tienda-linda', enabled: false });
    assert.deepEqual(updates, [
      {
        id: 'demo_1',
        password_gate_enabled: false,
        password_gate_password: LEGACY_PASSWORD,
      },
    ]);
  });

  it('pero una palabra NUEVA más larga que el máximo se rechaza', async () => {
    const { container, updates } = makeContainer({ demos: [demo()] });
    await saveGateSite(container, {
      scope: 'demo:tienda-linda',
      enabled: true,
      password: LEGACY_PASSWORD,
    });
    assert.deepEqual(updates, [
      { id: 'demo_1', password_gate_enabled: false, password_gate_password: null },
    ]);
  });

  it('reemplazarla por una del largo nuevo la actualiza', async () => {
    const { container, updates } = makeContainer({
      demos: [demo({ password_gate_password: LEGACY_PASSWORD })],
    });
    await saveGateSite(container, {
      scope: 'demo:tienda-linda',
      enabled: true,
      password: 'nueva1',
    });
    assert.deepEqual(updates, [
      { id: 'demo_1', password_gate_enabled: true, password_gate_password: 'nueva1' },
    ]);
  });
});
