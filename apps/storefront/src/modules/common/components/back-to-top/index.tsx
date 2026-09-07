"use client";

import { cn } from "@lib/util/cn";
import {
  FLOATING_LAYER,
  floatingObstacle,
} from "@lib/util/floating-obstacle";
import { useTenant } from "@lib/site-config/context";
import { ArrowUpIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

export default function BackToTop() {
  const tenant = useTenant();
  const [visible, setVisible] = useState(false);
  const isSportsTemplate = tenant.template === "sports";

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Volver arriba"
      {...floatingObstacle("back-to-top", FLOATING_LAYER.tray)}
      className={cn(
        "fixed bottom-[132px] left-4 z-[1000] flex h-10 w-10 items-center justify-center bg-[--primary-color] text-white transition-all duration-300 hover:opacity-90 lg:right-6 lg:bottom-[5.5rem] lg:left-auto",
        isSportsTemplate
          ? "sports-back-to-top rounded-none border-2 border-[--sp-ink] shadow-none"
          : "rounded-full shadow-lg",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 pointer-events-none",
      )}
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  );
}
