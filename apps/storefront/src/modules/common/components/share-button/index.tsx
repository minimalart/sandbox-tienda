"use client";

import { ShareIcon } from "@heroicons/react/24/outline";
import { triggerHaptic } from "@lib/util/haptics";
import { useState } from "react";

type ShareButtonProps = {
  /** Product handle to build the share URL; falls back to current path. */
  handle?: string | null;
  title?: string | null;
  className?: string;
  size?: "sm" | "md";
  /** When set, renders the labeled row variant (like the quick view). */
  label?: string;
};

/**
 * Share a product via the native share sheet, with clipboard fallback.
 * Mirrors the quick-view share action; icon-only by default, labeled when
 * `label` is passed.
 */
const ShareButton = ({
  handle,
  title,
  className = "",
  size = "sm",
  label,
}: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);
  const iconSize = label ? "h-5 w-5" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  const buttonSize = size === "md" ? "h-9 w-9" : "h-7 w-7";

  const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    triggerHaptic("light");
    const path = handle ? `/products/${handle}` : window.location.pathname;
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: title ?? "Producto", url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Native share cancelled — ignore.
    }
  };

  if (label) {
    return (
      <button
        className={`group flex items-center gap-2 font-semibold text-gray-900 text-sm transition-colors hover:text-[--primary-color] ${className}`}
        onClick={handleShare}
        title="Compartir"
        type="button"
      >
        <ShareIcon
          aria-hidden="true"
          className={`${iconSize} text-gray-500 transition-colors group-hover:text-[--primary-color]`}
        />
        {copied ? "¡Copiado!" : label}
      </button>
    );
  }

  return (
    <button
      aria-label="Compartir"
      className={`group relative z-10 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${buttonSize} ${className}`}
      onClick={handleShare}
      title="Compartir"
      type="button"
    >
      <ShareIcon
        aria-hidden="true"
        className={`${iconSize} text-gray-500 transition-colors group-hover:text-[--primary-color]`}
      />
      <span className="-top-9 pointer-events-none absolute left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-950 px-2.5 py-1 font-semibold text-[11px] text-white shadow-lg group-hover:block">
        {copied ? "¡Copiado!" : "Compartir"}
      </span>
    </button>
  );
};

export default ShareButton;
