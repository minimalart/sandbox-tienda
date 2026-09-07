/**
 * Repositorios - Capa de acceso a datos
 * 
 * Los repositorios encapsulan la lógica de acceso a la API de Medusa.
 * - Server Components: Importan directamente los repositorios
 * - Client Components: Usan hooks que llaman a las API routes
 * 
 * Arquitectura:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Server Components  →  Repositorios  →  Medusa SDK             │
 * │  Client Components  →  Hooks  →  API Routes  →  Repositorios   │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * Products:
 * - listProducts()      → Listar productos
 * - getProductById()    → Obtener producto por ID
 * 
 * Categories:
 * - listCategories()    → Listar categorías
 * - getCategoryById()   → Obtener categoría por ID
 * 
 * Collections:
 * - listCollections()   → Listar colecciones
 * - getCollectionById() → Obtener colección por ID
 * 
 * Cart:
 * - retrieveCart()        → Obtener carrito
 * - createCart()          → Crear carrito
 * - getOrCreateCart()     → Obtener o crear carrito
 * - updateCart()          → Actualizar carrito
 * - updateCartAddresses() → Actualizar direcciones
 * - addCartLineItem()     → Agregar item
 * - updateCartLineItem()  → Actualizar cantidad
 * - removeCartLineItem()  → Eliminar item
 * - setCartShippingMethod() → Seleccionar envío
 * - initiateCartPayment() → Iniciar pago
 * - applyCartPromotions() → Aplicar promociones
 * - completeCart()        → Completar orden
 * - clearCart()           → Limpiar carrito
 * 
 * Checkout:
 * - listShippingOptions()    → Métodos de envío
 * - calculateShippingPrice() → Calcular precio de envío
 * - listPaymentProviders()   → Métodos de pago
 */

export * from "./products.repository";
export * from "./categories.repository";
export * from "./collections.repository";
export * from "./cart.repository";
export * from "./checkout.repository";
