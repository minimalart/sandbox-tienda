"use client";

import Reveal from "@modules/common/components/reveal";
import { useTenant } from "@lib/site-config/context";
import { useEffect, useState } from "react";

const incentives = [
  {
    name: "Envío Gratuito",
    description:
      "Entregas a todo el país sin costo adicional y seguimiento completo",
    imageSrc: "/envio-gratuito.svg",
  },
  {
    name: "Pago Flexible",
    description: "Múltiples opciones de pago seguras y financiación disponible",
    imageSrc: "/pago-flexible.svg",
  },
  {
    name: "Compra Segura",
    description:
      "Tus datos protegidos con encriptación y garantía de satisfacción",
    imageSrc: "/compra-segura.svg",
  },
  {
    name: "Soporte 24/7",
    description: "Atención personalizada cuando la necesités, todos los días",
    imageSrc: "/soporte24-7.svg",
  },
];

// Componente para renderizar SVG con colores dinámicos
const ColoredSvg = ({ src, primaryColor, className }: { src: string; primaryColor: string; className?: string }) => {
  const [svgContent, setSvgContent] = useState<string>("");

  useEffect(() => {
    fetch(src)
      .then((res) => res.text())
      .then((text) => {
        // Reemplazar el color hardcodeado #007A96 con el color primario del tenant
        // Manejar diferentes formatos: #007A96, 007A96, rgb(0, 122, 150)
        let processedSvg = text;
        
        // Reemplazar formato hex con #
        processedSvg = processedSvg.replace(/#007A96/gi, primaryColor);
        
        // Reemplazar formato hex sin # (en atributos como fill="007A96")
        processedSvg = processedSvg.replace(/fill="007A96"/gi, `fill="${primaryColor}"`);
        processedSvg = processedSvg.replace(/stroke="007A96"/gi, `stroke="${primaryColor}"`);
        processedSvg = processedSvg.replace(/stop-color="007A96"/gi, `stop-color="${primaryColor}"`);
        
        // Reemplazar en valores RGB si están presentes
        processedSvg = processedSvg.replace(/rgb\(0,\s*122,\s*150\)/gi, primaryColor);
        
        setSvgContent(processedSvg);
      })
      .catch((err) => {
        console.error("Error loading SVG:", err);
      });
  }, [src, primaryColor]);

  if (!svgContent) {
    return <div className={className} />;
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};

const BenefitsInfo = () => {
  const tenant = useTenant();
  const primaryColor = tenant.theme.colors.primary;

  return (
    <Reveal as="section" className="bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16 lg:max-w-7xl lg:px-8">
        <Reveal as="div" className="mb-12 text-center">
          <p className="home-section-heading">
            Beneficios {tenant.name}
          </p>
        </Reveal>
        <div className="grid grid-cols-4 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-8">
          {incentives.map((incentive, index) => (
            <Reveal as="div" delay={index * 80} key={incentive.name}>
              <ColoredSvg
                src={incentive.imageSrc}
                primaryColor={primaryColor}
                className="h-16 w-auto sm:h-20 [&>svg]:h-full [&>svg]:w-auto"
              />
              <h3 className="mt-4 font-semibold text-gray-900 text-xs sm:text-sm">
                {incentive.name}
              </h3>
              <p className="mt-2 hidden text-gray-500 text-sm sm:block">
                {incentive.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </Reveal>
  );
};

export default BenefitsInfo;
