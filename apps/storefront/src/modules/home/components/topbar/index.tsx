'use client';

import {
  BanknotesIcon,
  BellIcon,
  BoltIcon,
  BuildingStorefrontIcon,
  CheckBadgeIcon,
  ClockIcon,
  CreditCardIcon,
  FireIcon,
  GiftIcon,
  GlobeAltIcon,
  HeartIcon,
  MapPinIcon,
  MegaphoneIcon,
  PhoneIcon,
  ReceiptPercentIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  TicketIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useBannersByPlacement } from '@lib/context/banners-context';
import type { TopbarIconType } from '@lib/site-config/types';
import { useTenantBrand } from '@lib/site-config/context';
import { useEffect, useMemo, useState } from 'react';

// Mapa de iconos disponibles
export const iconMap: Record<
  TopbarIconType,
  React.ComponentType<{ className?: string; 'aria-hidden'?: any }>
> = {
  'credit-card': CreditCardIcon,
  truck: TruckIcon,
  gift: GiftIcon,
  shield: ShieldCheckIcon,
  star: StarIcon,
  tag: TagIcon,
  sparkles: SparklesIcon,
  fire: FireIcon,
  bolt: BoltIcon,
  clock: ClockIcon,
  phone: PhoneIcon,
  'map-pin': MapPinIcon,
  heart: HeartIcon,
  'check-badge': CheckBadgeIcon,
  banknotes: BanknotesIcon,
  // El storefront usa siempre el ícono de carrito; "shopping-bag" se mantiene en
  // el type por compatibilidad de config, pero renderiza el carrito.
  'shopping-bag': ShoppingCartIcon,
  'shopping-cart': ShoppingCartIcon,
  'receipt-percent': ReceiptPercentIcon,
  ticket: TicketIcon,
  megaphone: MegaphoneIcon,
  bell: BellIcon,
  globe: GlobeAltIcon,
  rocket: RocketLaunchIcon,
  'building-storefront': BuildingStorefrontIcon,
};

const HomeTopbar = () => {
  const { topbar } = useTenantBrand();
  const { banners, isLoading } = useBannersByPlacement('top_bar');
  const [dismissed, setDismissed] = useState(false);

  // Usar configuración del tenant o valores por defecto
  const messages = useMemo(() => {
    if (!isLoading && banners.length > 0) {
      const mapped = banners
        .filter((b) => !!(b.title || b.text))
        .map((b) => ({
          id: b.id,
          text: (b.title || b.text) as string,
          Icon: iconMap[(b.icon as TopbarIconType) ?? ''] || CreditCardIcon,
          // La barra superior es una franja de marca: el fondo usa SIEMPRE el
          // color primario del tenant activo (una demo pinta su propio color, no
          // el verde de Mercatto), con texto/ícono en blanco. Antes tomaba el
          // `card_color` del banner, que quedaba verde por el preset del form
          // (#166534) aunque la demo fuera de otro color. El banner solo aporta
          // el texto y el ícono.
          backgroundColor: 'var(--primary-color)',
          textColor: '#ffffff',
          iconColor: '#ffffff',
        }));
      if (mapped.length > 0) return mapped;
    }

    if (topbar?.messages && topbar.messages.length > 0) {
      return topbar.messages.map((msg) => ({
        id: msg.id,
        text: msg.text,
        Icon: iconMap[msg.icon] || CreditCardIcon,
        backgroundColor: 'var(--primary-color)',
        textColor: '#ffffff',
        iconColor: '#ffffff',
      }));
    }

    // Valores por defecto si no hay configuración
    return [
      {
        id: 'payment',
        text: 'Tarjeta o efectivo',
        Icon: CreditCardIcon,
        backgroundColor: 'var(--primary-color)',
        textColor: '#ffffff',
        iconColor: '#ffffff',
      },
      {
        id: 'shipping',
        text: 'Envío gratis',
        Icon: TruckIcon,
        backgroundColor: 'var(--primary-color)',
        textColor: '#ffffff',
        iconColor: '#ffffff',
      },
    ];
  }, [banners, isLoading, topbar]);

  const rotationInterval = topbar?.rotationInterval || 6000;
  const [activeMessage, setActiveMessage] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return; // No rotar si hay un solo mensaje

    const interval = setInterval(() => {
      setActiveMessage((prev) => (prev + 1) % messages.length);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [messages.length, rotationInterval]);

  // Si está deshabilitado o no hay mensajes, no mostrar
  if (dismissed || topbar?.enabled === false || messages.length === 0) {
    return null;
  }

  const currentMessage = messages[activeMessage];

  return (
    <div
      aria-live="polite"
      className="relative flex h-10 items-center justify-center overflow-hidden border-gray-100 border-b px-10 sm:px-12"
      style={{
        backgroundColor: currentMessage.backgroundColor,
        color: currentMessage.textColor,
      }}
    >
      <div
        className="flex min-w-0 animate-fade-in-right items-center justify-center gap-2 text-center font-medium text-sm/6"
        key={currentMessage.id}
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-current/10">
          <currentMessage.Icon
            aria-hidden={true}
            className="h-4 w-4"
            style={{ color: currentMessage.iconColor }}
          />
        </span>
        <p className="text-center">{currentMessage.text}</p>
      </div>
      <button
        aria-label="Cerrar barra superior"
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-current/85 transition hover:bg-current/10 hover:text-current focus:outline-none focus:ring-2 focus:ring-current/30"
        onClick={() => {
          setDismissed(true);
        }}
        type="button"
      >
        <XMarkIcon aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
};

export default HomeTopbar;
