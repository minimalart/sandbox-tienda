# Context Providers

## ProductsCacheProvider (Opcional)

Si necesitas acceso global a productos en componentes del cliente, puedes agregar el `ProductsCacheProvider` al layout.

### Implementación en Layout

```typescript
// src/app/[countryCode]/(main)/layout.tsx

import { ProductsCacheProvider } from "@lib/context/products-cache-context";
import { getAlternatedProducts } from "@lib/data/products";

export default async function PageLayout(props: { 
  children: React.ReactNode;
  params: Promise<{ countryCode: string }>;
}) {
  const params = await props.params;
  const { countryCode } = params;
  
  // Cargar productos iniciales (opcional)
  const initialProducts = await getAlternatedProducts({
    limit: 50,
    step: 15,
    countryCode,
  });

  return (
    <ChannelProvider>
      <AddToCartAnimationProvider>
        <ProductsCacheProvider initialProducts={initialProducts}>
          {/* ... resto del layout */}
          {props.children}
        </ProductsCacheProvider>
      </AddToCartAnimationProvider>
    </ChannelProvider>
  );
}
```

### Uso en Componentes Cliente

```typescript
"use client";

import { useProducts } from "@lib/hooks/use-products";

export function StoreProducts() {
  const { products, isLoading } = useProducts();
  
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

## Cuándo usar el Provider

✅ **Usar cuando:**
- Necesitas acceso frecuente a productos en múltiples componentes cliente
- Implementas búsqueda/filtrado en tiempo real
- Quieres evitar múltiples llamadas a la API

❌ **No usar cuando:**
- Solo necesitas productos en server components
- Los productos se cargan una sola vez
- Prefieres mantener la aplicación más ligera

## Nota

Actualmente el sistema funciona sin el Provider usando las funciones optimizadas directamente en server components, que es más eficiente para la mayoría de casos de uso.
