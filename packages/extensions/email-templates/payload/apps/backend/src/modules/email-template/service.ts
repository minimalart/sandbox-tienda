import { MedusaService } from '@medusajs/framework/utils';
import { EmailTemplate } from './models';

class EmailTemplateModuleService extends MedusaService({
  EmailTemplate,
}) {
  /**
   * Normalizes a template key. Preserves dots so Medusa event names
   * (e.g. `order.placed`) survive alongside dash-separated app keys
   * (e.g. `order-cancelled`).
   */
  generateKey(name: string): string {
    const base = (name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 96);
    return base || 'email-template';
  }

  /**
   * La clave es única POR TIENDA, no por instancia.
   *
   * Esto MIRABA TODA LA TABLA, y era la otra mitad —la de escritura— del bug de la
   * plantilla inalcanzable. El modelo declara DOS índices únicos PARCIALES, uno para
   * `site_id IS NULL` y otro para `site_id IS NOT NULL`, justamente para que la tienda
   * B pueda tener su propia `password-reset` sin pisar la global. Con el chequeo
   * global, esa segunda plantilla nacía con la clave `password-reset-2` — que NO es la
   * clave que `createNotifications` emite. La plantilla quedaba guardada, publicada, y
   * jamás se usaba: el operador la veía en el listado con un nombre casi idéntico y sin
   * ninguna pista de por qué su mail no cambiaba.
   *
   * El sufijo sigue existiendo para el caso legítimo: dos plantillas distintas de la
   * MISMA tienda cuyo nombre normaliza a la misma clave.
   *
   * `siteId` es explícito y sin default de conveniencia a propósito: un default
   * `= null` haría que un call site que se olvida de pasarlo compile y compare contra
   * las globales, que es exactamente el bug de vuelta.
   */
  async ensureUniqueKey(
    key: string,
    excludeId: string | undefined,
    siteId: string | null,
  ): Promise<string> {
    const normalized = this.generateKey(key);
    let candidate = normalized;
    let suffix = 2;
    for (;;) {
      // `{ site_id: null }` se emite como `site_id IS NULL` y matchea la global.
      // OJO con la forma de array (`{ site_id: [id, null] }`): en Postgres eso es
      // `IN (id, NULL)` y NO matchea un NULL — ya rompió el mínimo de compra una vez.
      const existing = await this.listEmailTemplates({ key: candidate, site_id: siteId });
      const taken = existing.some(
        (tpl: { id: string }) => tpl.id !== excludeId,
      );
      if (!taken) {
        return candidate;
      }
      candidate = `${normalized}-${suffix}`;
      suffix += 1;
    }
  }
}

export default EmailTemplateModuleService;
