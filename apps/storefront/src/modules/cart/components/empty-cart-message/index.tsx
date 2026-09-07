import { Heading, Text } from "@medusajs/ui";

import InteractiveLink from "@modules/common/components/interactive-link";

const EmptyCartMessage = () => (
  <div
    className="flex flex-col items-start justify-center px-2 py-48"
    data-testid="empty-cart-message"
  >
    <Heading
      className="flex flex-row items-baseline gap-x-2 text-3xl-regular"
      level="h1"
    >
      Carrito
    </Heading>
    <Text className="mt-4 mb-6 max-w-[32rem] text-base-regular">
      No tenés nada en tu carrito. Cambiemos eso, usá el enlace de abajo para
      empezar a explorar nuestros productos.
    </Text>
    <div>
      <InteractiveLink href="/store">Explorar productos</InteractiveLink>
    </div>
  </div>
);

export default EmptyCartMessage;
