import { MedusaService } from '@medusajs/framework/utils';
import { getKapsoSettings } from '../kapso-whatsapp/settings';
import { WhatsappConversation } from './models';
import {
  WA_HISTORY_LIMIT,
  WA_SESSION_IDLE_HOURS,
  type WaDraftItem,
  type WaSession,
  type WaTurn,
} from './types';

/**
 * Servicio del estado conversacional de WhatsApp. Todo se accede por `phone`
 * (una fila por teléfono); los helpers hacen get-or-create internamente para que
 * las native tools no tengan que preocuparse por el ciclo de vida de la fila.
 */
class WhatsappAgentModuleService extends MedusaService({ WhatsappConversation }) {
  /** Devuelve la fila del teléfono, creándola si no existe. */
  async getOrCreate(phone: string): Promise<any> {
    const existing = (await this.listWhatsappConversations({ phone }))[0];
    if (existing) return existing;
    const created: any = await this.createWhatsappConversations([{ phone }] as any);
    return Array.isArray(created) ? created[0] : created;
  }

  /** Cachea la identidad resuelta del cliente (para prefijar el checkout link). */
  async setIdentity(
    phone: string,
    identity: { customer_id?: string | null; email?: string | null; country_code?: string | null },
  ): Promise<void> {
    const row = await this.getOrCreate(phone);
    await this.updateWhatsappConversations([
      {
        id: row.id,
        customer_id: identity.customer_id ?? row.customer_id ?? null,
        email: identity.email ?? row.email ?? null,
        country_code: identity.country_code ?? row.country_code ?? null,
      },
    ] as any);
  }

  /** Historial reciente como [{ role, content }] (o [] si no hay). */
  async getHistory(phone: string): Promise<WaTurn[]> {
    const row = (await this.listWhatsappConversations({ phone }))[0];
    const msgs = (row?.messages as WaTurn[] | null) ?? [];
    return Array.isArray(msgs) ? msgs : [];
  }

  /** Agrega el turno (user + assistant) y recorta a la ventana. */
  async appendTurn(phone: string, userMsg: string, assistantMsg: string): Promise<void> {
    const row = await this.getOrCreate(phone);
    const prev = (row.messages as WaTurn[] | null) ?? [];
    const next = [...prev, { role: 'user' as const, content: userMsg }, { role: 'assistant' as const, content: assistantMsg }];
    const trimmed = next.slice(-WA_HISTORY_LIMIT);
    await this.updateWhatsappConversations([{ id: row.id, messages: trimmed }] as any);
  }

  /** Persiste solo un mensaje entrante del cliente (p. ej. durante un handoff,
   * cuando el bot no responde) para no perder el hilo cuando vuelva al bot. */
  async appendInbound(phone: string, userMsg: string): Promise<void> {
    const row = await this.getOrCreate(phone);
    const prev = (row.messages as WaTurn[] | null) ?? [];
    const trimmed = [...prev, { role: 'user' as const, content: userMsg }].slice(-WA_HISTORY_LIMIT);
    await this.updateWhatsappConversations([{ id: row.id, messages: trimmed }] as any);
  }

  async getDraft(phone: string): Promise<WaDraftItem[]> {
    const row = (await this.listWhatsappConversations({ phone }))[0];
    const items = (row?.draft_items as WaDraftItem[] | null) ?? [];
    return Array.isArray(items) ? items : [];
  }

  /** Agrega/incrementa una variante en el borrador. */
  async addToDraft(phone: string, item: WaDraftItem): Promise<WaDraftItem[]> {
    const row = await this.getOrCreate(phone);
    const items = ((row.draft_items as WaDraftItem[] | null) ?? []).slice();
    const idx = items.findIndex((i) => i.variant_id === item.variant_id);
    const existing = idx >= 0 ? items[idx] : undefined;
    if (existing) {
      items[idx] = { variant_id: existing.variant_id, quantity: existing.quantity + item.quantity };
    } else {
      items.push({ variant_id: item.variant_id, quantity: item.quantity });
    }
    await this.updateWhatsappConversations([{ id: row.id, draft_items: items }] as any);
    return items;
  }

  /** Fija la cantidad EXACTA de una variante (no incrementa). <=0 la quita. */
  async setDraftQuantity(phone: string, variantId: string, quantity: number): Promise<WaDraftItem[]> {
    const row = await this.getOrCreate(phone);
    const current = ((row.draft_items as WaDraftItem[] | null) ?? []).slice();
    let items: WaDraftItem[];
    if (quantity <= 0) {
      items = current.filter((i) => i.variant_id !== variantId);
    } else {
      const idx = current.findIndex((i) => i.variant_id === variantId);
      if (idx >= 0) {
        current[idx] = { variant_id: variantId, quantity };
        items = current;
      } else {
        items = [...current, { variant_id: variantId, quantity }];
      }
    }
    await this.updateWhatsappConversations([{ id: row.id, draft_items: items }] as any);
    return items;
  }

  async removeFromDraft(phone: string, variantId: string): Promise<WaDraftItem[]> {
    const row = await this.getOrCreate(phone);
    const items = ((row.draft_items as WaDraftItem[] | null) ?? []).filter(
      (i) => i.variant_id !== variantId,
    );
    await this.updateWhatsappConversations([{ id: row.id, draft_items: items }] as any);
    return items;
  }

  /** Guarda el token de checkout SIN vaciar el borrador (el carrito conversacional
   *  sigue disponible por si el cliente vuelve sin pagar y quiere editarlo). El
   *  vaciado real lo hace `clearDraft` (pago/nueva compra) o `resetDraftIfStale`. */
  async setLastCheckoutToken(phone: string, checkoutToken: string): Promise<void> {
    const row = await this.getOrCreate(phone);
    await this.updateWhatsappConversations([
      { id: row.id, last_checkout_token: checkoutToken },
    ] as any);
  }

  async clearDraft(phone: string, checkoutToken?: string | null): Promise<void> {
    const row = await this.getOrCreate(phone);
    await this.updateWhatsappConversations([
      { id: row.id, draft_items: [], last_checkout_token: checkoutToken ?? row.last_checkout_token ?? null },
    ] as any);
  }

  /**
   * Descarta el borrador si la conversación estuvo inactiva demasiado tiempo. El
   * `draft_items` persiste por teléfono y solo se limpia al generar el link de pago;
   * sin esto, ítems de una sesión vieja (o de pruebas) reaparecen como "producto
   * fantasma" en la siguiente compra. Usa `updated_at` (lo mantiene MedusaService),
   * así que no requiere migración. No crea la fila si no existe.
   */
  async resetDraftIfStale(phone: string, maxIdleHours = 12): Promise<void> {
    const row = (await this.listWhatsappConversations({ phone }))[0];
    if (!row) return;
    const items = (row.draft_items as WaDraftItem[] | null) ?? [];
    if (!Array.isArray(items) || items.length === 0) return;
    const updated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    if (updated && (Date.now() - updated) / 3_600_000 >= maxIdleHours) {
      await this.updateWhatsappConversations([{ id: row.id, draft_items: [] }] as any);
    }
  }

  // --- Sesión comercial (PRD §25) ---

  /**
   * Sesión en curso, creándola si no hay o si venció por inactividad.
   *
   * El `session_id` se deriva del teléfono + el momento de arranque en vez de un
   * uuid random: los scripts de workflow del repo no pueden usar `Math.random`,
   * y así el id es reproducible y ordenable. Alcanza para agrupar el embudo.
   */
  async getSession(phone: string): Promise<WaSession> {
    const row = await this.getOrCreate(phone);
    const current = (row.session as WaSession | null) ?? null;
    const idleMs = WA_SESSION_IDLE_HOURS * 3_600_000;
    const lastActivity = current?.updated_at ? new Date(current.updated_at).getTime() : 0;
    const expired = !current || !lastActivity || Date.now() - lastActivity >= idleMs;
    if (!expired) return current as WaSession;

    const started = new Date();
    const fresh: WaSession = {
      session_id: `${phone.replace(/\D/g, '')}-${started.getTime()}`,
      intent: null,
      step: null,
      answers: {},
      shown_variant_ids: [],
      updated_at: started.toISOString(),
    };
    await this.updateWhatsappConversations([{ id: row.id, session: fresh }] as any);
    return fresh;
  }

  /** Mergea cambios sobre la sesión y refresca `updated_at`. */
  async patchSession(phone: string, patch: Partial<WaSession>): Promise<WaSession> {
    const current = await this.getSession(phone);
    const row = await this.getOrCreate(phone);
    const next: WaSession = { ...current, ...patch, updated_at: new Date().toISOString() };
    await this.updateWhatsappConversations([{ id: row.id, session: next }] as any);
    return next;
  }

  /**
   * Arranca una sesión nueva ("empezar de nuevo", §25). Vacía además el borrador:
   * si no, el pedido anterior se arrastra al nuevo recorrido.
   */
  async resetSession(phone: string): Promise<WaSession> {
    const row = await this.getOrCreate(phone);
    await this.updateWhatsappConversations([{ id: row.id, session: null, draft_items: [] }] as any);
    return this.getSession(phone);
  }

  /** Acumula variantes ya ofrecidas para no repetir opciones. */
  async rememberShownVariants(phone: string, variantIds: string[]): Promise<void> {
    if (variantIds.length === 0) return;
    const current = await this.getSession(phone);
    const merged = Array.from(new Set([...(current.shown_variant_ids ?? []), ...variantIds]));
    await this.patchSession(phone, { shown_variant_ids: merged });
  }

  // --- Handoff a humano ---

  /** Horas tras las que un handoff sin resolver vuelve solo al bot (default 6). */
  private autoResumeHours(): number {
    const raw = Number(getKapsoSettings().handoffAutoResumeHours);
    return Number.isFinite(raw) && raw > 0 ? raw : 6;
  }

  /** Marca la conversación como "en atención humana" (el bot deja de responder). */
  async escalate(phone: string, reason?: string | null): Promise<void> {
    const row = await this.getOrCreate(phone);
    await this.updateWhatsappConversations([
      {
        id: row.id,
        status: 'pending_human',
        escalated_at: new Date(),
        escalation_reason: reason ?? null,
      },
    ] as any);
  }

  /** Devuelve la conversación al bot (resuelto por un humano o por inactividad). */
  async resume(phone: string): Promise<void> {
    const row = await this.getOrCreate(phone);
    await this.updateWhatsappConversations([
      { id: row.id, status: 'bot', escalated_at: null, escalation_reason: null },
    ] as any);
  }

  /**
   * ¿La conversación está en manos de un humano (el bot NO debe responder)?
   * Aplica auto-resume: si el handoff superó la ventana de inactividad, lo devuelve
   * al bot y responde false.
   */
  async isPaused(phone: string): Promise<boolean> {
    const row = (await this.listWhatsappConversations({ phone }))[0];
    const status = row?.status ?? 'bot';
    if (status !== 'pending_human' && status !== 'human') return false;
    const escalatedAt = row?.escalated_at ? new Date(row.escalated_at) : null;
    if (escalatedAt) {
      const ageHours = (Date.now() - escalatedAt.getTime()) / (60 * 60 * 1000);
      if (ageHours >= this.autoResumeHours()) {
        await this.resume(phone);
        return false;
      }
    }
    return true;
  }

  /** Conversaciones actualmente en atención humana (para el panel del admin). */
  async listPaused(): Promise<any[]> {
    return this.listWhatsappConversations(
      { status: ['pending_human', 'human'] },
      { order: { escalated_at: 'ASC' } },
    );
  }

  /** Toma manual del operador: pausa el bot para este contacto (status 'human'). */
  async takeOver(phone: string): Promise<void> {
    const row = await this.getOrCreate(phone);
    await this.updateWhatsappConversations([
      { id: row.id, status: 'human', escalated_at: new Date(), escalation_reason: 'Atención manual del equipo' },
    ] as any);
  }

  /** Conversaciones recientes (cualquier estado) para el panel del admin. */
  async listRecent(limit = 20): Promise<any[]> {
    return this.listWhatsappConversations({}, { take: limit, order: { updated_at: 'DESC' } });
  }
}

export default WhatsappAgentModuleService;
