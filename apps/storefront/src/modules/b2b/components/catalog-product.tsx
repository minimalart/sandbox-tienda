'use client';
import { useState } from 'react';
import type { HttpTypes } from '@medusajs/types';
import type { B2BPriceInfo } from '@lib/data/company';
import { presentationFactor } from '@lib/util/catalog-commercial';
import { convertToLocale } from '@lib/util/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CatalogProduct({
  product,
  prices,
  countryCode,
}: {
  product: HttpTypes.StoreProduct;
  prices: Record<string, B2BPriceInfo>;
  countryCode: string;
}) {
  const [variantId, setVariantId] = useState(product.variants?.[0]?.id ?? '');
  const [mode, setMode] = useState<'unit' | 'package'>('unit');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const info = prices[variantId];
  const c = info?.commercial;
  const p = c?.presentation;
  const canPackage =
    c?.purchasePolicy?.enabled &&
    c.purchasePolicy.allowedModes?.includes('package') &&
    (presentationFactor(c) > 1 || (p?.mode === 'own-sku' && p.priceBasis === 'sku'));
  const selectedMode =
    canPackage && c?.purchasePolicy?.allowedModes && !c.purchasePolicy.allowedModes.includes('unit')
      ? 'package'
      : mode;
  const factor = selectedMode === 'package' ? presentationFactor(c) : 1;
  const units = quantity * factor;
  const format = (amount: number) =>
    convertToLocale({
      amount,
      currency_code:
        info?.currency_code ||
        c?.currencyCode ||
        product.variants?.find((v) => v.id === variantId)?.calculated_price?.currency_code ||
        '',
    });
  async function add() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/b2b/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          countryCode,
          lines: [
            {
              variant_id: variantId,
              quantity,
              presentation_mode: canPackage ? selectedMode : undefined,
            },
          ],
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw new Error(data.error || 'No se pudo agregar el producto.');
      setMessage(
        'Agregado al pedido. El carrito aplica el precio vigente para la cantidad seleccionada.'
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="grid gap-6 rounded-lg border bg-background p-5 md:grid-cols-2">
      {product.thumbnail && (
        <img
          src={product.thumbnail}
          alt={product.title ?? ''}
          className="aspect-square w-full rounded-md object-contain"
        />
      )}
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{product.title}</h1>
        <p className="text-sm text-muted-foreground">{product.description}</p>
        <label className="block text-sm">
          SKU
          <select
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setMode('unit');
              setMessage('');
            }}
            className="mt-1 block w-full rounded border bg-background p-2"
          >
            {product.variants?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </label>
        {c?.measurementUnit && (
          <p className="text-sm">
            Medida: {c.unitMultiplier} {c.measurementUnit}
          </p>
        )}
        {p?.label && (
          <p>
            {p.label}
            {p.unitsPerPackage ? ` × ${p.unitsPerPackage}` : ''}
          </p>
        )}
        {canPackage && (
          <label className="block text-sm">
            Presentación
            <select
              value={selectedMode}
              onChange={(e) => setMode(e.target.value as 'unit' | 'package')}
              className="mt-1 block w-full rounded border bg-background p-2"
            >
              <option
                value="unit"
                disabled={
                  c?.purchasePolicy?.allowedModes && !c.purchasePolicy.allowedModes.includes('unit')
                }
              >
                {p?.mode === 'own-sku' ? 'SKU caja' : 'Unidades'}
              </option>
              <option value="package">
                {p?.label || 'Bulto'}
                {p?.unitsPerPackage ? ` × ${p.unitsPerPackage}` : ''}
              </option>
            </select>
          </label>
        )}
        {info?.unit_price != null ? (
          <div>
            <p className="text-xl font-semibold">
              {format(info.unit_price)} por {p?.mode === 'own-sku' ? 'caja / SKU' : 'unidad'}
            </p>
            {c?.listAmount != null &&
              c.listAmount > info.unit_price &&
              c.currencyCode === info.currency_code &&
              typeof c.priceTaxIncluded === 'boolean' &&
              c.priceTaxIncluded === info.price_tax_included && (
                <del className="text-sm text-muted-foreground">{format(c.listAmount)}</del>
              )}
            {selectedMode === 'package' && (
              <p>
                {format(info.unit_price * factor)} por {p?.label || 'bulto'}
              </p>
            )}
          </div>
        ) : (
          <p>No hay precio disponible para este SKU.</p>
        )}
        <label className="block text-sm">
          Cantidad de{' '}
          {selectedMode === 'package'
            ? p?.label || 'bultos'
            : p?.mode === 'own-sku'
              ? 'cajas'
              : 'unidades'}
          <Input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="mt-1 max-w-32"
          />
        </label>
        <p>
          {units} {p?.mode === 'own-sku' ? 'cajas' : 'unidades'} · Total estimado:{' '}
          {info?.unit_price != null ? format(info.unit_price * units) : '—'}
        </p>
        {p?.mode === 'informational' && (
          <p className="text-sm text-muted-foreground">
            Presentación informativa. No hay conversión por bulto confirmada.
          </p>
        )}
        {info?.available === 0 && <p>Esta presentación no está disponible.</p>}
        <Button
          disabled={
            busy ||
            info?.unit_price == null ||
            info.available <= 0 ||
            !Number.isSafeInteger(quantity) ||
            quantity < 1
          }
          onClick={add}
        >
          {busy ? 'Agregando…' : 'Agregar al pedido'}
        </Button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
    </article>
  );
}
