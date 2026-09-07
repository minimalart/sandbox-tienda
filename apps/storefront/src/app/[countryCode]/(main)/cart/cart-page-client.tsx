"use client";

import { useEffect, useState } from "react";
import type { HttpTypes } from "@medusajs/types";
import CartTemplate from "@modules/cart/templates";

type CartPageClientProps = {
  initialCustomer: HttpTypes.StoreCustomer | null;
};

export default function CartPageClient({ initialCustomer }: CartPageClientProps) {
  const [cart, setCart] = useState<HttpTypes.StoreCart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const response = await fetch("/api/store/cart");
        const data = await response.json();
        setCart(data.cart);
      } catch (error) {
        console.error("Error fetching cart:", error);
        setCart(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCart();

    // Escuchar eventos de actualización del carrito
    const handleCartUpdate = () => {
      fetchCart();
    };

    window.addEventListener("cart-updated", handleCartUpdate);

    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white">
        <main className="mx-auto max-w-2xl px-4 pt-16 pb-24 sm:px-6 lg:max-w-7xl lg:px-8">
          <h1 className="font-bold text-3xl text-gray-900 tracking-tight sm:text-4xl">
            Carrito de compras
          </h1>
          <div className="mt-12">
            <p className="text-gray-600">Cargando carrito...</p>
          </div>
        </main>
      </div>
    );
  }

  return <CartTemplate cart={cart} customer={initialCustomer} />;
}

