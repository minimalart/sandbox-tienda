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

// Mapa de íconos disponibles. `style` está en el contrato porque el render
// pinta el ícono con el `iconColor` del banner (`style={{ color }}`); el tipo
// estrecho anterior sobrevivía en el árbol viejo gracias al fallback hardcoded
// a `CreditCardIcon` (props más anchas) que ensanchaba la unión — al quitar
// ese fallback hay que declararlo explícito acá.
export const iconMap: Record<
  TopbarIconType,
  React.ComponentType<{
    className?: string;
    'aria-hidden'?: any;
    style?: React.CSSProperties;
  }>
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

/** Default que el form viejo de banners imponía a `card_color` (verde Mercatto). */
const LEGACY_DEFAULT_CARD_COLOR = '#166534';

const HomeTopbar = () => {
  const { topbar } = useTenantBrand();
  const { banners, isLoading } = useBannersByPlacement('top_bar');
  const [dismissed, setDismissed] = useState(false);

  // La topbar depende ÚNICAMENTE de banners con placement `top_bar` publicados
  // para el sales channel activo. Sin banners no se muestra nada — no hay
  // fallback a `tenant.topbar.messages` ni a mensajes hardcoded.
  const messages = useMemo(() => {
    if (isLoading || banners.length === 0) return [];
    return banners
      .filter((b) => !!(b.title || b.text))
      .map((b) => ({
        id: b.id,
        text: (b.title || b.text) as string,
        Icon: iconMap[(b.icon as TopbarIconType) ?? ''] || CreditCardIcon,
        // Colores editables desde el banner (`card_color`/`color_font`/
        // `icon_color`). Sin valor explícito caen al preset de marca: fondo =
        // color primario del tenant activo, texto e ícono en blanco. El
        // hardcode previo pisaba SIEMPRE el `card_color` porque el form viejo
        // defaulteaba a `#166534` (verde Mercatto) y contaminaba demos de
        // otros colores; el form actual ya no impone default y el operador
        // decide.
        // Los banners guardados con ese form viejo todavía traen `#166534`:
        // se tratan como "sin color" para que la demo pinte su primario.
        backgroundColor:
          b.card_color && b.card_color.trim().toLowerCase() !== LEGACY_DEFAULT_CARD_COLOR
            ? b.card_color
            : 'var(--primary-color)',
        textColor: b.color_font || '#ffffff',
        iconColor: b.icon_color || '#ffffff',
      }));
  }, [banners, isLoading]);

  const rotationInterval = topbar?.rotationInterval || 6000;
  const [activeMessage, setActiveMessage] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return; // No rotar si hay un solo mensaje

    const interval = setInterval(() => {
      setActiveMessage((prev) => (prev + 1) % messages.length);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [messages.length, rotationInterval]);

  // `topbar.enabled === false` queda como kill-switch manual del tenant; sin
  // banners tampoco hay nada que renderizar.
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
