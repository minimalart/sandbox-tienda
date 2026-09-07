"use client";

import { useTenant } from "@lib/site-config/context";
import { useCartStore } from "@lib/stores/cart.store";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type AnimationTarget = "cart" | "wishlist";

type AnimationItem = {
  id: string;
  startX: number;
  startY: number;
  thumbnail?: string;
  target: AnimationTarget;
};

type AnimationContextType = {
  triggerAnimation: (element: HTMLElement, thumbnail?: string) => void;
  triggerWishlistAnimation: (element: HTMLElement) => void;
  cartBounce: boolean;
  wishlistBounce: boolean;
  registerCartIcon: (element: HTMLElement | null) => void;
  registerWishlistIcon: (element: HTMLElement | null) => void;
};

const AnimationContext = createContext<AnimationContextType | undefined>(
  undefined,
);

/** Duración del vuelo al carrito, en segundos. */
const FLIGHT_DURATION = 0.38;
const FLIGHT_MS = FLIGHT_DURATION * 1000;

type AnimationDropProps = {
  anim: AnimationItem;
  targetX: number;
  targetY: number;
};

function AnimationDrop({ anim, targetX, targetY }: AnimationDropProps) {
  const isWishlist = anim.target === "wishlist";

  return (
    <motion.div
      animate={{ x: targetX, y: targetY, scale: 0.3, opacity: 1 }}
      className="pointer-events-none fixed z-[9999]"
      exit={{ scale: 0, opacity: 0, transition: { duration: 0.12 } }}
      initial={{ x: anim.startX, y: anim.startY, scale: 1, opacity: 1 }}
      key={anim.id}
      style={{ left: 0, top: 0, willChange: "transform" }}
      transition={{
        // easeOutQuint: arranca al toque y frena cerca del carrito. Antes eran
        // 0.6s con una curva simétrica, que se leía como "tarda en salir".
        x: { duration: FLIGHT_DURATION, ease: [0.22, 1, 0.36, 1] },
        y: { duration: FLIGHT_DURATION, ease: [0.22, 1, 0.36, 1] },
        // Tween en vez de spring: el spring seguía oscilando después de que la
        // posición ya había llegado, estirando la animación percibida.
        scale: { duration: FLIGHT_DURATION, ease: [0.22, 1, 0.36, 1] },
      }}
    >
      {anim.thumbnail && !isWishlist ? (
        <div
          className="h-16 w-16 overflow-hidden rounded-lg border-2 border-green-600 shadow-2xl"
          style={{
            boxShadow:
              "0 0 30px rgba(46, 125, 50, 0.6), 0 20px 25px -5px rgba(0, 0, 0, 0.3)",
          }}
        >
          <img
            alt="Product"
            className="h-full w-full object-cover"
            height={64}
            src={anim.thumbnail}
            width={64}
          />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center rounded-full shadow-2xl ${
            isWishlist ? "h-12 w-12 bg-rose-500" : "h-12 w-12 bg-[--primary-color]"
          }`}
          style={{
            boxShadow: isWishlist
              ? "0 0 30px rgba(244, 63, 94, 0.45), 0 20px 25px -5px rgba(0, 0, 0, 0.3)"
              : "0 0 30px rgba(46, 125, 50, 0.6), 0 20px 25px -5px rgba(0, 0, 0, 0.3)",
          }}
        >
          {isWishlist ? (
            <svg
              aria-label="Favoritos"
              className="h-6 w-6 text-white"
              fill="currentColor"
              role="img"
              viewBox="0 0 24 24"
            >
              <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          ) : (
            <svg
              aria-label="Carrito"
              className="h-6 w-6 text-white"
              fill="none"
              role="img"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          )}
        </div>
      )}
    </motion.div>
  );
}

export const useAddToCartAnimation = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error(
      "useAddToCartAnimation must be used within AddToCartAnimationProvider",
    );
  }
  return context;
};

export const AddToCartAnimationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [animations, setAnimations] = useState<AnimationItem[]>([]);
  const [cartBounce, setCartBounce] = useState(false);
  const [wishlistBounce, setWishlistBounce] = useState(false);
  // En el template deportivo no usamos la animación de "vuelo al carrito": en su
  // lugar abrimos el cart drawer (que muestra el producto agregado + sugerencias
  // de "completá tu compra"), más alineado con la identidad de marca.
  const tenant = useTenant();
  const isSportsTemplate = tenant.template === "sports";
  const openCart = useCartStore((s) => s.openCart);
  const cartIconRef = useRef<HTMLElement | null>(null);
  const wishlistIconRef = useRef<HTMLElement | null>(null);
  const cartPositionRef = useRef<{ x: number; y: number } | null>(null);
  const wishlistPositionRef = useRef<{ x: number; y: number } | null>(null);

  const updateIconPosition = useCallback(
    (
      ref: React.MutableRefObject<HTMLElement | null>,
      positionRef: React.MutableRefObject<{ x: number; y: number } | null>,
    ) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          positionRef.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
        }
      }
    },
    [],
  );

  const registerCartIcon = useCallback(
    (element: HTMLElement | null) => {
      cartIconRef.current = element;
      if (element) {
        setTimeout(
          () => updateIconPosition(cartIconRef, cartPositionRef),
          100,
        );
      }
    },
    [updateIconPosition],
  );

  const registerWishlistIcon = useCallback(
    (element: HTMLElement | null) => {
      wishlistIconRef.current = element;
      if (element) {
        setTimeout(
          () => updateIconPosition(wishlistIconRef, wishlistPositionRef),
          100,
        );
      }
    },
    [updateIconPosition],
  );

  const getTargetPosition = useCallback(
    (target: AnimationTarget): { x: number; y: number } => {
      const iconRef = target === "cart" ? cartIconRef : wishlistIconRef;
      const positionRef =
        target === "cart" ? cartPositionRef : wishlistPositionRef;

      if (positionRef.current) {
        return positionRef.current;
      }

      if (iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
        }
      }

      const isMobile =
        typeof window !== "undefined" && window.innerWidth < 1024;

      return {
        x:
          typeof window !== "undefined"
            ? target === "wishlist"
              ? window.innerWidth - 36
              : window.innerWidth / 2
            : 0,
        y:
          typeof window !== "undefined"
            ? isMobile
              ? window.innerHeight - 52
              : 32
            : 0,
      };
    },
    [],
  );

  const triggerTargetAnimation = useCallback(
    (element: HTMLElement, target: AnimationTarget, thumbnail?: string) => {
      const rect = element.getBoundingClientRect();
      const id = `anim-${Date.now()}-${Math.random()}`;

      setAnimations((prev) => [
        ...prev,
        {
          id,
          startX: rect.left + rect.width / 2,
          startY: rect.top + rect.height / 2,
          thumbnail,
          target,
        },
      ]);

      // El rebote del ícono va justo cuando la imagen aterriza, y la limpieza
      // apenas después: encadenados a FLIGHT_MS para que no queden desfasados
      // si se vuelve a tocar la duración del vuelo.
      setTimeout(() => {
        if (target === "cart") {
          setCartBounce(true);
          setTimeout(() => setCartBounce(false), 250);
        } else {
          setWishlistBounce(true);
          setTimeout(() => setWishlistBounce(false), 250);
        }
      }, FLIGHT_MS * 0.85);

      setTimeout(() => {
        setAnimations((prev) => prev.filter((anim) => anim.id !== id));
      }, FLIGHT_MS + 60);
    },
    [],
  );

  const triggerAnimation = useCallback(
    (element: HTMLElement, thumbnail?: string) => {
      if (isSportsTemplate) {
        openCart();
        return;
      }
      triggerTargetAnimation(element, "cart", thumbnail);
    },
    [triggerTargetAnimation, isSportsTemplate, openCart],
  );

  const triggerWishlistAnimation = useCallback(
    (element: HTMLElement) => {
      triggerTargetAnimation(element, "wishlist");
    },
    [triggerTargetAnimation],
  );

  // Memoizado: sin esto, cada `setAnimations` recreaba el value y re-renderizaba
  // TODOS los consumidores (cada card de una grilla) en el mismo frame del
  // click, justo cuando la imagen tiene que despegar.
  const contextValue = useMemo(
    () => ({
      triggerAnimation,
      triggerWishlistAnimation,
      cartBounce,
      wishlistBounce,
      registerCartIcon,
      registerWishlistIcon,
    }),
    [
      triggerAnimation,
      triggerWishlistAnimation,
      cartBounce,
      wishlistBounce,
      registerCartIcon,
      registerWishlistIcon,
    ],
  );

  return (
    <AnimationContext.Provider value={contextValue}>
      {/* `reducedMotion="user"` deja que framer-motion desactive automáticamente
          las animaciones de transform/layout (vuelo al carrito, escalas y giros
          del selector de cantidad, etc.) cuando el usuario pide movimiento
          reducido, conservando solo el fundido de opacidad. */}
      <MotionConfig reducedMotion="user">
        {children}
        <AnimatePresence>
          {animations.map((anim) => {
            const { x, y } = getTargetPosition(anim.target);
            return (
              <AnimationDrop
                anim={anim}
                key={anim.id}
                targetX={x}
                targetY={y}
              />
            );
          })}
        </AnimatePresence>
      </MotionConfig>
    </AnimationContext.Provider>
  );
};
