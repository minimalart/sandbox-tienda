import type { TechBenefitIcon, TechPromoIcon } from "@lib/site-config/types";
import {
  BadgeCheck,
  Banknote,
  Clock,
  CreditCard,
  Gift,
  Headphones,
  Landmark,
  type LucideIcon,
  Lock,
  Percent,
  RefreshCw,
  ShieldCheck,
  Store,
  Tag,
  Truck,
} from "lucide-react";

const PROMO_ICONS: Record<TechPromoIcon, LucideIcon> = {
  "credit-card": CreditCard,
  bank: Landmark,
  truck: Truck,
  clock: Clock,
  tag: Tag,
  percent: Percent,
  gift: Gift,
};

const BENEFIT_ICONS: Record<TechBenefitIcon, LucideIcon> = {
  truck: Truck,
  store: Store,
  shield: ShieldCheck,
  lock: Lock,
  headset: Headphones,
  "credit-card": CreditCard,
  refresh: RefreshCw,
  "badge-check": BadgeCheck,
};

export function PromoIcon({
  name,
  className,
}: {
  name?: TechPromoIcon;
  className?: string;
}) {
  const Icon = name ? PROMO_ICONS[name] ?? Banknote : Banknote;
  return <Icon className={className} />;
}

export function BenefitIcon({
  name,
  className,
}: {
  name: TechBenefitIcon;
  className?: string;
}) {
  const Icon = BENEFIT_ICONS[name] ?? BadgeCheck;
  return <Icon className={className} />;
}
