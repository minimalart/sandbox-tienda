"use client";

/** Cubre el stepper y anima la tapa del tacho mientras se quita la línea. */
export default function CartTrashFlight() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 flex animate-atc-trash-overlay items-center justify-center rounded-[inherit] bg-red-600 text-white motion-reduce:animate-none"
    >
      <span className="relative h-7 w-7">
        <svg
          className="absolute inset-0 z-10 h-7 w-7 animate-atc-trash-item text-red-200 motion-reduce:animate-none"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M19 8 12 4 5 8l7 4 7-4Z" />
          <path d="M5 8v5l7 4 7-4V8" />
        </svg>
        <svg
          className="absolute inset-0 z-20 h-7 w-7 animate-atc-trash-bin motion-reduce:animate-none"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path d="M6.5 8.5 7.4 20h9.2l.9-11.5" />
          <path d="M10 11.5v5M14 11.5v5" />
        </svg>
        <svg
          className="absolute inset-0 z-30 h-7 w-7 animate-atc-trash-lid motion-reduce:animate-none"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path d="M5 7.5h14M9 7.5V5h6v2.5" />
        </svg>
      </span>
    </span>
  );
}
