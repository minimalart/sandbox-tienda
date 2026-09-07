import { Button, Container, Text } from "@medusajs/ui";
import { cookies as nextCookies } from "next/headers";

async function ProductOnboardingCta() {
  const cookies = await nextCookies();

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true";

  if (!isOnboarding) {
    return null;
  }

  return (
    <Container className="h-full w-full max-w-4xl bg-ui-bg-subtle p-8">
      <div className="center flex flex-col gap-y-4">
        <Text className="text-ui-fg-base text-xl">
          ¡Tu producto de demostración se creó correctamente! 🎉
        </Text>
        <Text className="text-small-regular text-ui-fg-subtle">
          Ahora podés seguir configurando tu tienda en el admin.
        </Text>
        <a href="http://localhost:7001/a/orders?onboarding_step=create_order_nextjs">
          <Button className="w-full">Continuar configuración en el admin</Button>
        </a>
      </div>
    </Container>
  );
}

export default ProductOnboardingCta;
