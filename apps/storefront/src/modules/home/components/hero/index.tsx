import { Github } from "@medusajs/icons";
import { Button, Heading } from "@medusajs/ui";

const Hero = () => (
  <div className="relative h-[75vh] w-full border-ui-border-base border-b bg-ui-bg-subtle">
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 text-center small:p-32">
      <span>
        <Heading
          className="font-normal text-3xl text-ui-fg-base leading-10"
          level="h1"
        >
          Plantilla inicial de ecommerce
        </Heading>
        <Heading
          className="font-normal text-3xl text-ui-fg-subtle leading-10"
          level="h2"
        >
          Impulsado por Medusa y Next.js
        </Heading>
      </span>
      <a
        href="https://github.com/medusajs/nextjs-starter-medusa"
        rel="noopener"
        target="_blank"
      >
        <Button variant="secondary">
          Ver en GitHub
          <Github />
        </Button>
      </a>
    </div>
  </div>
);

export default Hero;
