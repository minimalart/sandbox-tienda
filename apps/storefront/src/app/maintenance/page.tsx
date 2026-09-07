import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sitio en mantenimiento",
  description: "El sitio se encuentra temporalmente en mantenimiento.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header con logo */}
      <header className="px-6 py-6 sm:px-10 sm:py-8">
        <img
          alt="Mercatto"
          className="h-9 w-auto sm:h-10"
          src="/logo.webp"
        />
      </header>

      {/* Contenido central */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <img
          alt="Sitio en mantenimiento"
          className="mb-8 h-[180px] w-[243px] sm:h-[200px] sm:w-[270px] object-contain"
          src="/mantenimiento.png"
        />
        <h1 className="font-bold text-2xl text-[#13294B] sm:text-3xl">
          Estamos haciendo unas mejoras
        </h1>
        <p className="mt-4 max-w-md text-gray-500 text-sm leading-relaxed sm:text-base">
          El sitio se encuentra temporalmente en mantenimiento.
          <br />
          Estamos trabajando para volver lo antes posible.
          <br />
          Muchas gracias por tu paciencia.
        </p>
      </main>

      {/* Footer */}
      <footer className="border-gray-900/10 border-t px-6 py-6 sm:px-10">
        <div className="flex flex-col items-center gap-3 text-gray-600 text-sm md:flex-row md:justify-between">
          <span>
            <strong>MERCATTO</strong> &copy; {new Date().getFullYear()} Todos
            los derechos reservados.
          </span>
          <a
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            href="https://minimalart.co/?utm_source=website&utm_medium=ecommerce&utm_campaign=storefront"
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt="Minimalart"
              className="h-3"
              src="/minimalart/logo-minimalart.svg"
            />
            <span className="text-gray-600 text-sm">| Evolution by design</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
