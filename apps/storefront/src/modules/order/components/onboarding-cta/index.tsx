"use client";

import { resetOnboardingState } from "@lib/data/onboarding";
import { Button, Container, Text } from "@medusajs/ui";

const OnboardingCta = ({ orderId }: { orderId: string }) => (
  <Container className="h-full w-full max-w-4xl bg-ui-bg-subtle">
    <div className="center flex flex-col gap-y-4 p-4 md:items-center">
      <Text className="text-ui-fg-base text-xl">
        ¡Tu pedido de prueba se creó correctamente! 🎉
      </Text>
      <Text className="text-small-regular text-ui-fg-subtle">
        Ahora podés terminar de configurar tu tienda en el admin.
      </Text>
      <Button
        className="w-fit"
        onClick={() => resetOnboardingState(orderId)}
        size="xlarge"
      >
        Completar configuración en el admin
      </Button>
    </div>
  </Container>
);

export default OnboardingCta;
