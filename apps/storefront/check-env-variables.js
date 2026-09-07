const c = require("ansi-colors");

/**
 * MULTI-HOST (tiendas por subdominio) — env vars OPCIONALES, a propósito.
 *
 * NO van en `requiredEnvs`: agregarlas ahí haría fallar el build de TODO deploy que no
 * las setee, incluido el sitio principal, que no las necesita. Son el interruptor de
 * la resolución por host:
 *
 *   NEXT_PUBLIC_SITE_HOST_SUFFIX   Sufijo de host de las tiendas, con el punto:
 *                                  `.sites.ejemplo.com`. Si el host de la request
 *                                  termina con esto y el primer label es un slug
 *                                  válido, ESE label es el slug. Aritmética de
 *                                  strings, cero I/O.
 *                                  SIN ESTA VARIABLE todo el código de host es
 *                                  no-op y el sitio se resuelve por path/cookie
 *                                  exactamente como antes. Es lo que permite
 *                                  mergear el multi-host apagado y prenderlo (o
 *                                  revertirlo) cambiando una variable, en vez de
 *                                  revertir PRs en dos caminos de deploy no atómicos.
 *
 *   NEXT_PUBLIC_PRIMARY_HOST       Host del sitio principal. Sólo se usa para elegir
 *                                  el esquema en desarrollo (`localhost` → http).
 *
 * Para probar en local NO hace falta tocar /etc/hosts: `*.localhost` resuelve a
 * 127.0.0.1 en Chrome y Firefox. Con `NEXT_PUBLIC_SITE_HOST_SUFFIX=.localhost`,
 * `http://moda.localhost:3000` ejercita toda la ruta de subdominio (el dev server
 * escucha en 3000, no 8000).
 */
const requiredEnvs = [
  {
    key: "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
    // TODO: we need a good doc to point this to
    description:
      "Learn how to create a publishable key: https://docs.medusajs.com/v2/resources/storefront-development/publishable-api-keys",
  },
  {
    key: "NEXT_PUBLIC_COUNTRY_CODE",
    description:
      "ISO 2-letter country code used to resolve the Medusa region (e.g. 'ar'). Replaces the previous [countryCode] URL segment.",
  },
  {
    key: "NEXT_PUBLIC_SALES_CHANNEL_ID",
    description:
      "Medusa sales channel ID used to filter products by channel in browser-side Typesense search. Without this, all products from all channels appear to the browser.",
  },
];

function checkEnvVariables() {
  const missingEnvs = requiredEnvs.filter((env) => !process.env[env.key]);

  if (missingEnvs.length > 0) {
    console.error(
      c.red.bold("\n🚫 Error: Missing required environment variables\n")
    );

    for (const env of missingEnvs) {
      console.error(c.yellow(`  ${c.bold(env.key)}`));
      if (env.description) {
        console.error(c.dim(`    ${env.description}\n`));
      }
    }

    console.error(
      c.yellow(
        "\nPlease set these variables in your .env file or environment before starting the application.\n"
      )
    );

    process.exit(1);
  }
}

module.exports = checkEnvVariables;
