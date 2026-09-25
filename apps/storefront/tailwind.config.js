const path = require("path");

module.exports = {
  darkMode: "class",
  presets: [require("@medusajs/ui-preset")],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/modules/**/*.{js,ts,jsx,tsx}",
    // `lib/` también, porque ahí viven las constantes de clases compartidas
    // (`lib/util/product-image-presets.ts`). Sin este glob Tailwind no ve esas
    // clases en su fuente real: se aplican en el HTML pero no existe la regla
    // que las respalda, y el bug es invisible — no falla el build, no falla el
    // typecheck, la card simplemente pierde el estilo. Hoy `p-[10%]` se salvaba
    // sólo porque aparece MENCIONADA en un comentario de `thumbnail/index.tsx`,
    // que sí se escanea; borrar ese comentario habría dejado sin aire a todas
    // las fotos del catálogo.
    "./src/lib/**/*.{js,ts,jsx,tsx}",
    // Los componentes compartidos del contrato viven FUERA de `src` y entran
    // por alias del tsconfig (`@modules/common/components/checkbox-input`,
    // `product-image`, `scroll-carousel`). Sin este glob Tailwind no los ve
    // y sus clases no existen en el CSS: el componente renderiza, el build
    // pasa, el typecheck pasa, y el estilo simplemente no está.
    //
    // Bug histórico (DESDEELSUR-61 / BUG-06): el tilde de `CheckboxInput` se
    // pinta con `peer-checked:...`, regla que nunca se generó — no aparecía
    // en NINGÚN chunk CSS servido. El checkbox "Necesito Factura A"
    // alternaba los campos pero jamás se veía tildado, igual que los de
    // login, filtros de tienda, localizador, shop-by-look, devoluciones y
    // suscripciones.
    //
    // REGLA: la base y las hijas consumen el MISMO artefacto (`dist/` del
    // plugin publicado). Cualquier bug de compilación aparece en las dos.
    // pnpm symlinkea el workspace local del boilerplate a
    // `node_modules/@minimalart/...`, así que este glob resuelve al `dist/`
    // compilado (que el `^build` de Turbo genera). En las hijas resuelve
    // al `dist/` del tarball publicado. Una línea, dos entornos, mismo
    // comportamiento — la asimetría previa (src en base, dist en hijas)
    // ocultaba bugs de compilación hasta producción de un derivado.
    //
    // El glob se deriva de los alias del tsconfig; `tailwind-content-coverage
    // .test.ts` falla si se agrega un alias a un paquete que este array no
    // cubra.
    "./node_modules/@minimalart/mercatto-plugin-storefront-shared/dist/**/*.js",
    "./node_modules/@medusajs/ui/dist/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      transitionProperty: {
        width: "width margin",
        height: "height",
        bg: "background-color",
        display: "display opacity",
        visibility: "visibility",
        padding: "padding-top padding-right padding-bottom padding-left",
      },
      colors: {
        grey: {
          0: "#FFFFFF",
          5: "#F9FAFB",
          10: "#F3F4F6",
          20: "#E5E7EB",
          30: "#D1D5DB",
          40: "#9CA3AF",
          50: "#6B7280",
          60: "#4B5563",
          70: "#374151",
          80: "#1F2937",
          90: "#111827",
        },
        "cerulean-blue": {
          50: "hsl(var(--cerulean-blue-50) / <alpha-value>)",
          100: "hsl(var(--cerulean-blue-100) / <alpha-value>)",
          200: "hsl(var(--cerulean-blue-200) / <alpha-value>)",
          300: "hsl(var(--cerulean-blue-300) / <alpha-value>)",
          400: "hsl(var(--cerulean-blue-400) / <alpha-value>)",
          500: "hsl(var(--cerulean-blue-500) / <alpha-value>)",
          600: "hsl(var(--cerulean-blue-600) / <alpha-value>)",
          700: "hsl(var(--cerulean-blue-700) / <alpha-value>)",
          800: "hsl(var(--cerulean-blue-800) / <alpha-value>)",
          900: "hsl(var(--cerulean-blue-900) / <alpha-value>)",
          950: "hsl(var(--cerulean-blue-950) / <alpha-value>)",
        },
        "social-icon": "var(--social-icon-color)",
        // shadcn/ui tokens (usados por el portal B2B). Keys nuevos: aditivos,
        // no pisan la paleta del storefront ni del preset de @medusajs/ui.
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        none: "0px",
        soft: "2px",
        base: "4px",
        rounded: "8px",
        large: "16px",
        circle: "9999px",
      },
      maxWidth: {
        "8xl": "100rem",
      },
      screens: {
        "2xsmall": "320px",
        xsmall: "512px",
        small: "1024px",
        medium: "1280px",
        large: "1440px",
        xlarge: "1680px",
        "2xlarge": "1920px",
      },
      fontSize: {
        "3xl": "2rem",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Ubuntu",
          "sans-serif",
        ],
        display: ["var(--font-manrope)", "Manrope", "sans-serif"],
        // Alias legacy: clases font-roboto existentes resuelven a Inter
        roboto: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      boxShadow: {
        "mc-sm": "var(--mc-shadow-sm)",
        "mc-md": "var(--mc-shadow-md)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        ring: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in-right": {
          "0%": {
            opacity: "0",
            transform: "translateX(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        "fade-in-top": {
          "0%": {
            opacity: "0",
            transform: "translateY(-10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "fade-out-top": {
          "0%": {
            height: "100%",
          },
          "99%": {
            height: "0",
          },
          "100%": {
            visibility: "hidden",
          },
        },
        "accordion-slide-up": {
          "0%": {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
          "100%": {
            height: "0",
            opacity: "0",
          },
        },
        "accordion-slide-down": {
          "0%": {
            "min-height": "0",
            "max-height": "0",
            opacity: "0",
          },
          "100%": {
            "min-height": "var(--radix-accordion-content-height)",
            "max-height": "none",
            opacity: "1",
          },
        },
        enter: {
          "0%": { transform: "scale(0.9)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        leave: {
          "0%": { transform: "scale(1)", opacity: 1 },
          "100%": { transform: "scale(0.9)", opacity: 0 },
        },
        "slide-in": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(0)" },
        },

        // --- Botón avión (newsletter del footer y formulario de contacto) ---
        // La etiqueta sale hacia arriba, el avión despega en diagonal dejando
        // dos estelas, y entra el estado de éxito desde abajo.
        "plane-label-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-120%)" },
        },
        "plane-fly": {
          "0%": { opacity: "0", transform: "translate(-48px, 12px) scale(.6)" },
          "25%": { opacity: "1", transform: "translate(0, 0) scale(1)" },
          "55%": { opacity: "1", transform: "translate(0, 0) scale(1)" },
          "100%": {
            opacity: "0",
            transform: "translate(72px, -24px) scale(.5)",
          },
        },
        "plane-trail": {
          "0%, 45%": { strokeDashoffset: "64", opacity: "0" },
          "60%": { strokeDashoffset: "0", opacity: "1" },
          "100%": { strokeDashoffset: "-64", opacity: "0" },
        },
        "plane-success-in": {
          "0%, 55%": { opacity: "0", transform: "translateY(120%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },

        // --- Agregar al carrito ---
        // El carrito entra desde la izquierda, el ítem cae dentro, el carrito
        // acusa el golpe y se va rodando por la derecha. Cada paso reescribe
        // el `transform` completo: un solo elemento no puede acumular dos
        // animaciones que lo toquen.
        "atc-cart": {
          "0%": { transform: "translate(-48px, 0) scale(.75)" },
          "22%, 58%": { transform: "translate(0, 0) scale(1)" },
          "63%": { transform: "translate(0, 3px) scale(1)" },
          "68%": { transform: "translate(0, 0) scale(1)" },
          "82%": { opacity: "1", transform: "translate(52px, 0) rotate(-12deg)" },
          "100%": { opacity: "0", transform: "translate(120px, 0) rotate(0deg)" },
        },
        "atc-item": {
          "0%": { opacity: "0", transform: "translate(0, -42px) scale(0)" },
          "14%, 40%": { opacity: "1", transform: "translate(0, -40px) scale(1)" },
          "58%": { opacity: "1", transform: "translate(0, 2px) scale(.9)" },
          "64%, 100%": { opacity: "0", transform: "translate(0, 2px) scale(0)" },
        },
        "atc-label": {
          "0%": { opacity: "1", transform: "translateX(0)" },
          "12%, 96%": { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // --- Sacar del carrito (inversa) ---
        // Sólo con el tacho a la vista, o sea cantidad 1. El rojo cubre todo el
        // stepper mientras el producto cae, la tapa se abre y vuelve a cerrar.
        "atc-trash-overlay": {
          "0%, 82%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "atc-trash-lid": {
          "0%, 12%": { transform: "translate(0, 0) rotate(0deg)" },
          "28%, 64%": { transform: "translate(3px, -4px) rotate(-24deg)" },
          "80%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
        },
        "atc-trash-bin": {
          "0%, 18%": { transform: "scale(1)" },
          "32%, 66%": { transform: "scale(1.08)" },
          "80%": { transform: "scale(.94)" },
          "92%, 100%": { transform: "scale(1)" },
        },
        "atc-trash-fade": {
          "0%": { opacity: "1" },
          "18%, 100%": { opacity: "0" },
        },
        "atc-trash-item": {
          "0%": { opacity: "0", transform: "translateY(-22px) scale(.9)" },
          "25%": { opacity: "1", transform: "translateY(-18px) scale(1)" },
          "70%": { opacity: "1", transform: "translateY(2px) scale(.55)" },
          "78%, 100%": { opacity: "0", transform: "translateY(4px) scale(0)" },
        },
        // Relevo: cuando el carrito terminó de irse, el stepper de cantidad
        // entra en el mismo lugar que ocupaba el botón (y al revés al sacar).
        "atc-stepper-in": {
          "0%": { opacity: "0", transform: "scale(.88)" },
          "60%": { opacity: "1", transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "plane-label-out": "plane-label-out .3s ease-in forwards",
        "plane-fly": "plane-fly 1.1s cubic-bezier(.4,0,.2,1) forwards",
        "plane-trail": "plane-trail 1.1s ease-out forwards",
        "plane-success-in": "plane-success-in 1.1s cubic-bezier(.4,0,.2,1) forwards",
        "atc-cart": "atc-cart 1.1s cubic-bezier(.4,0,.2,1) forwards",
        "atc-item": "atc-item 1.1s cubic-bezier(.4,0,.2,1) forwards",
        "atc-label": "atc-label 1.1s ease-in-out forwards",
        "atc-stepper-in": "atc-stepper-in .32s cubic-bezier(.34,1.56,.64,1) both",
        "atc-trash-overlay": "atc-trash-overlay 1.1s ease forwards",
        "atc-trash-lid": "atc-trash-lid 1.1s cubic-bezier(.4,0,.2,1) forwards",
        "atc-trash-bin": "atc-trash-bin 1.1s cubic-bezier(.4,0,.2,1) forwards",
        "atc-trash-fade": "atc-trash-fade .9s ease-out forwards",
        "atc-trash-item": "atc-trash-item 1.1s cubic-bezier(.4,0,.2,1) forwards",
        "fade-in-up": "fade-in-up 0.5s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
        ring: "ring 2.2s cubic-bezier(0.5, 0, 0.5, 1) infinite",
        "fade-in-right":
          "fade-in-right 0.3s cubic-bezier(0.5, 0, 0.5, 1) forwards",
        "fade-in-top": "fade-in-top 0.2s cubic-bezier(0.5, 0, 0.5, 1) forwards",
        "fade-out-top":
          "fade-out-top 0.2s cubic-bezier(0.5, 0, 0.5, 1) forwards",
        "accordion-open":
          "accordion-slide-down 300ms cubic-bezier(0.87, 0, 0.13, 1) forwards",
        "accordion-close":
          "accordion-slide-up 300ms cubic-bezier(0.87, 0, 0.13, 1) forwards",
        enter: "enter 200ms ease-out",
        "slide-in": "slide-in 1.2s cubic-bezier(.41,.73,.51,1.02)",
        leave: "leave 150ms ease-in forwards",
      },
    },
  },
  plugins: [require("tailwindcss-radix")(), require("tailwindcss-animate")],
};
