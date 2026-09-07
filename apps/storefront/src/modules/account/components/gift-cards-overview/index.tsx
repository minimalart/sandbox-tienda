'use client';

import { convertToLocale } from '@lib/util/money';
import { Gift, History, ShoppingBag } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Movement = {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  reference: string;
  origin?: 'gift_card' | 'refund' | 'adjustment';
  masked_code?: string | null;
  note?: string | null;
  created_at: string;
};
type Wallet = { id: string; balance: number; currency_code: string; movements?: Movement[] };

const money = (amount: number, currency: string) =>
  `$ ${convertToLocale({ amount, currency_code: currency, minimumFractionDigits: 0, maximumFractionDigits: 0, locale: 'es-AR' })}`;
const origin = (movement: Movement) =>
  movement.origin === 'gift_card'
    ? 'Gift card'
    : movement.origin === 'refund' ||
        movement.reference.includes('refund') ||
        movement.reference.includes('return')
      ? 'Devolución'
      : 'Ajuste de saldo';

export default function GiftCardsOverview() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/store/gift-cards', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      setWallets(data.accounts ?? []);
      setError(null);
    } else {
      setWallets([]);
      setError(data.message ?? 'No se pudo cargar tu billetera.');
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const claim = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || claiming) return;
    setClaiming(true);
    setNotice(null);
    const response = await fetch('/api/store/gift-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim', code: code.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      setCode('');
      setNotice('Saldo acreditado correctamente.');
      await load();
    } else setNotice(data.message ?? 'No se pudo canjear el código.');
    setClaiming(false);
  };
  return (
    <div className="space-y-8" data-testid="gift-cards-page-wrapper">
      <form className="rounded-[24px] border border-gray-200 bg-white p-5" onSubmit={claim}>
        <h3 className="font-semibold text-gray-900">¿Tenés otro código?</h3>
        <p className="mt-1 text-sm text-gray-500">
          Canjealo una vez y después usá tu saldo directamente en el checkout.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 font-mono text-sm"
            onChange={(event) => setCode(event.target.value)}
            placeholder="MRC-XXXX-XXXX-XXXX"
            value={code}
          />
          <button
            className="rounded-xl bg-[var(--primary-color)] px-5 py-2.5 font-semibold text-white disabled:opacity-50"
            disabled={!code.trim() || claiming}
            type="submit"
          >
            {claiming ? 'Canjeando…' : 'Canjear'}
          </button>
        </div>
        {notice && <p className="mt-3 text-sm text-gray-600">{notice}</p>}
      </form>
      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Mi billetera</h2>
            <p className="text-sm text-gray-500">Cada moneda se muestra por separado.</p>
          </div>
          <a
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary-color)]"
            href="/store"
          >
            <ShoppingBag className="h-4 w-4" /> Usar saldo
          </a>
        </div>
        {loading ? (
          <div className="mt-4 h-32 animate-pulse rounded-3xl bg-gray-100" />
        ) : error ? (
          <p className="mt-4 rounded-2xl bg-white p-8 text-center text-gray-500">{error}</p>
        ) : wallets.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-10 text-center">
            <Gift className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-gray-500">Todavía no tenés saldo acreditado.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-5">
            {wallets.map((wallet) => (
              <article
                className="overflow-hidden rounded-[24px] border border-gray-200 bg-white"
                key={wallet.id}
              >
                <header className="flex items-center justify-between bg-[--mc-green-soft] px-6 py-6">
                  <div>
                    <p className="text-sm text-gray-500">
                      Saldo disponible · {wallet.currency_code.toUpperCase()}
                    </p>
                    <p className="mt-1 text-3xl font-black text-gray-950">
                      {money(wallet.balance, wallet.currency_code)}
                    </p>
                  </div>
                  <Gift className="h-10 w-10 text-[var(--primary-color)]" />
                </header>
                <div className="p-5">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <History className="h-4 w-4" /> Movimientos recientes
                  </h3>
                  {wallet.movements?.length ? (
                    <ul className="mt-3 divide-y divide-gray-100">
                      {wallet.movements.map((movement) => (
                        <li
                          className="flex items-center justify-between gap-4 py-3"
                          key={movement.id}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {origin(movement)}
                              {movement.masked_code ? ` · ${movement.masked_code}` : ''}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(
                                new Date(movement.created_at)
                              )}
                            </p>
                          </div>
                          <span
                            className={`font-semibold ${movement.type === 'credit' ? 'text-emerald-700' : 'text-gray-700'}`}
                          >
                            {movement.type === 'credit' ? '+' : '−'}
                            {money(Number(movement.amount), wallet.currency_code)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-gray-400">Sin movimientos recientes.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
