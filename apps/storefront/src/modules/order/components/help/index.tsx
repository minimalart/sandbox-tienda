import { Heading } from "@medusajs/ui";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

const Help = () => (
  <div className="mt-6">
    <Heading className="text-base-semi">¿Necesitas ayuda?</Heading>
    <div className="my-2 text-base-regular">
      <ul className="flex flex-col gap-y-2">
        <li>
          <LocalizedClientLink href="/contact">Contacto</LocalizedClientLink>
        </li>
        <li>
          <LocalizedClientLink href="/contact">
            Devoluciones & Cambios
          </LocalizedClientLink>
        </li>
      </ul>
    </div>
  </div>
);

export default Help;
