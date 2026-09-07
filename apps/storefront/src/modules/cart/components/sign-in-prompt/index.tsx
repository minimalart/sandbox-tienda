import { Button, Heading, Text } from "@medusajs/ui";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

const SignInPrompt = () => (
  <div className="flex items-center justify-between bg-white">
    <div>
      <Heading className="txt-xlarge" level="h2">
        ¿Ya tenés cuenta?
      </Heading>
      <Text className="txt-medium mt-2 text-ui-fg-subtle">
        Iniciá sesión para una mejor experiencia.
      </Text>
    </div>
    <div>
      <LocalizedClientLink href="/account">
        <Button
          className="h-10"
          data-testid="sign-in-button"
          variant="secondary"
        >
          Iniciar sesión
        </Button>
      </LocalizedClientLink>
    </div>
  </div>
);

export default SignInPrompt;
