import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_FALLBACK, pickStorefrontBase, storefrontOriginFromCors } from './base.ts';

/**
 * La base pública es el dominio al que apunta CADA link de tienda del admin. Si
 * esta resolución se mueve, se mueven todos los links a la vez y en silencio: no
 * hay error, no hay log, sólo un `href` que se ve bien y abre otra cosa. Es
 * literalmente el bug que originó esta ruta.
 *
 * Por eso el invariante que más se cuida acá no es que el valor nuevo funcione,
 * sino que el valor VACÍO no cambie nada.
 */

const CORS_PROD = 'https://tienda.midominio.com';

test('lo configurado en la card le gana a STORE_CORS', () => {
  assert.equal(
    pickStorefrontBase('https://nuevodominio.com', CORS_PROD),
    'https://nuevodominio.com',
  );
});

test('sin nada configurado se comporta igual que antes de que la card existiera', () => {
  // El caso que sostiene la compatibilidad: toda instalación que no toque el campo
  // sigue resolviendo por STORE_CORS, con el mismo resultado de siempre.
  assert.equal(pickStorefrontBase('', CORS_PROD), CORS_PROD);
  assert.equal(pickStorefrontBase('   ', CORS_PROD), CORS_PROD);
});

test('sin card y sin STORE_CORS cae a localhost, nunca al dominio de una marca', () => {
  assert.equal(pickStorefrontBase('', undefined), LOCAL_FALLBACK);
  assert.equal(pickStorefrontBase('', ''), LOCAL_FALLBACK);
});

test('la barra final se normaliza: el listado le concatena `/tienda/<slug>`', () => {
  // Sin esto el href queda `https://x.com//tienda/moda`.
  assert.equal(pickStorefrontBase('https://x.com/', undefined), 'https://x.com');
  assert.equal(pickStorefrontBase('https://x.com///', undefined), 'https://x.com');
});

test('de STORE_CORS se elige el origin público, no el primero', () => {
  // El primero suele ser localhost o un placeholder del starter en configs mixtas.
  assert.equal(
    storefrontOriginFromCors(`http://localhost:9000,${CORS_PROD}`),
    CORS_PROD,
  );
  assert.equal(
    storefrontOriginFromCors(`https://docs.medusajs.com,${CORS_PROD}`),
    CORS_PROD,
  );
  // Y entre públicos gana https.
  assert.equal(
    storefrontOriginFromCors(`http://viejo.midominio.com,${CORS_PROD}`),
    CORS_PROD,
  );
});

test('si TODOS los origins son locales se devuelve el primero igual', () => {
  // En desarrollo eso es exactamente lo que corresponde: no hay dominio público
  // que adivinar y devolver `undefined` mandaría al fallback sin el puerto real.
  assert.equal(storefrontOriginFromCors('http://localhost:8000'), 'http://localhost:8000');
  assert.equal(pickStorefrontBase('', 'http://localhost:8000'), 'http://localhost:8000');
});
