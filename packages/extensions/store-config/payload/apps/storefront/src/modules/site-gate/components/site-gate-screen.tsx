"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

type SiteGateScreenProps = {
  /** `store` | `demo:{slug}` — a qué sitio pertenece la contraseña. */
  scope: string
  /** Cuántas casillas dibujar (el largo de la palabra configurada). */
  length: number
  /** Logo del tenant activo. Llega por prop: acá no hay TenantProvider. */
  logo?: string
  brandName?: string
}

const FALLBACK_LOGO = "/logo.webp"

/**
 * Pantalla de la página de contraseña.
 *
 * Se muestra en lugar de TODO el storefront cuando el sitio tiene el gate activo
 * (ver app/[countryCode]/layout.tsx). Usa el color primario del tenant —la
 * variable `--primary-color` se hereda del <html> del layout raíz, así que una
 * demo pinta la pantalla con su propio color— y su logo.
 *
 * Una casilla por carácter, enmascarada, con auto-avance, pegado y auto-submit
 * al completarse. La palabra viaja a /api/site-gate; el backend es el único que
 * la conoce.
 */
const SiteGateScreen = ({ scope, length, logo, brandName }: SiteGateScreenProps) => {
  const boxes = Math.max(1, length)
  const [values, setValues] = useState<string[]>(() => Array(boxes).fill(""))
  const [status, setStatus] = useState<"idle" | "checking" | "error" | "success">("idle")
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  // Evita que el auto-submit se dispare dos veces por el mismo código.
  const submittedRef = useRef<string | null>(null)

  useEffect(() => {
    setValues(Array(boxes).fill(""))
    inputsRef.current[0]?.focus()
  }, [boxes])

  const focusBox = (index: number) => {
    const target = inputsRef.current[Math.max(0, Math.min(boxes - 1, index))]
    target?.focus()
    target?.select()
  }

  const reset = () => {
    setValues(Array(boxes).fill(""))
    submittedRef.current = null
    focusBox(0)
  }

  const submit = useCallback(
    async (code: string) => {
      setStatus("checking")
      try {
        const res = await fetch("/api/site-gate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, code }),
        })
        if (!res.ok) {
          setStatus("error")
          return
        }
        setStatus("success")
        // Recarga completa (y no router.refresh()) para que el sitio entre con
        // todo su chrome y sin depender del router cache: la cookie ya está
        // seteada, así que el layout deja pasar. El delay deja ver el tilde.
        setTimeout(() => window.location.reload(), 700)
      } catch {
        setStatus("error")
      }
    },
    [scope]
  )

  // Auto-submit al completar las casillas (mismo gesto que un código de un solo uso).
  useEffect(() => {
    const code = values.join("")
    if (code.length !== boxes || values.some((v) => v === "")) return
    if (submittedRef.current === code || status === "checking" || status === "success") return
    submittedRef.current = code
    void submit(code)
  }, [values, boxes, status, submit])

  // Tras un error, limpiar y volver al principio.
  useEffect(() => {
    if (status !== "error") return
    const timer = setTimeout(() => {
      reset()
      setStatus("idle")
    }, 1200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const setCharAt = (index: number, char: string) =>
    setValues((prev) => {
      const next = [...prev]
      next[index] = char
      return next
    })

  const onChange = (index: number, raw: string) => {
    if (status === "error") return
    const char = raw.replace(/\s/g, "").slice(-1)
    if (!char) {
      setCharAt(index, "")
      return
    }
    setCharAt(index, char)
    if (index < boxes - 1) focusBox(index + 1)
  }

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault()
      if (values[index]) {
        setCharAt(index, "")
        return
      }
      if (index > 0) {
        setCharAt(index - 1, "")
        focusBox(index - 1)
      }
      return
    }
    if (event.key === "Delete") {
      event.preventDefault()
      setCharAt(index, "")
      return
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      focusBox(index - 1)
      return
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      focusBox(index + 1)
    }
  }

  const onPaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData("text").replace(/\s/g, "")
    if (!pasted) return
    setValues((prev) => {
      const next = [...prev]
      for (let i = 0; i < pasted.length && index + i < boxes; i++) {
        next[index + i] = pasted[i] as string
      }
      return next
    })
    focusBox(index + pasted.length)
  }

  const disabled = status === "checking" || status === "success"

  return (
    <section
      className="fixed inset-0 z-[100] flex min-h-screen w-full flex-col overflow-auto bg-[--primary-color]"
      data-testid="site-gate"
    >
      {/* Un sitio con gate no se indexa. React 19 sube el meta al <head>. */}
      <meta content="noindex, nofollow" name="robots" />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          animate={status === "error" ? { x: [0, -10, 10, -8, 8, 0] } : { x: 0 }}
          className="w-full max-w-[480px]"
          transition={{ duration: 0.4 }}
        >
          <div className="animate-auth-view rounded-2xl bg-white px-5 py-8 shadow-xl sm:px-8 sm:py-10">
            <div className="flex flex-col items-center text-center">
              <img
                alt={brandName || "Logo"}
                className="animate-auth-logo mb-6 h-10 w-auto object-contain sm:h-12"
                src={logo || FALLBACK_LOGO}
              />

              {status === "success" ? (
                <>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[--primary-color]">
                    <svg
                      fill="none"
                      height="26"
                      stroke="white"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                      width="26"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <h1 className="animate-auth-title font-semibold text-gray-900 text-xl sm:text-2xl">
                    Acceso concedido
                  </h1>
                  <p className="animate-auth-subtitle mt-2 text-gray-500 text-sm">
                    Un segundo, estamos abriendo el sitio…
                  </p>
                </>
              ) : (
                <>
                  <h1 className="animate-auth-title font-semibold text-gray-900 text-xl sm:text-2xl">
                    Sitio en preparación
                  </h1>
                  <p className="animate-auth-subtitle mt-3 max-w-sm text-gray-500 text-sm leading-relaxed">
                    Todavía no abrimos al público. Si tenés la contraseña,
                    ingresala para entrar.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    {values.map((value, index) => (
                      <input
                        aria-label={`Carácter ${index + 1} de ${boxes}`}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        // w-9 en mobile para que las 6 casillas entren en una sola
                        // fila incluso a 320px de ancho (el admin limita la palabra a
                        // 6 caracteres justamente por esto).
                        className={`h-12 w-9 rounded-lg border text-center font-semibold text-gray-900 text-lg outline-none transition-colors focus:border-[--primary-color] focus:ring-1 focus:ring-[--primary-color] sm:w-10 ${
                          status === "error" ? "border-red-400 bg-red-50" : "border-gray-300"
                        }`}
                        disabled={disabled}
                        // eslint-disable-next-line react/no-array-index-key
                        key={index}
                        maxLength={1}
                        onChange={(e) => onChange(index, e.target.value)}
                        onKeyDown={(e) => onKeyDown(index, e)}
                        onPaste={(e) => onPaste(index, e)}
                        ref={(el) => {
                          inputsRef.current[index] = el
                        }}
                        spellCheck={false}
                        // `type="password"` enmascara en todos los navegadores;
                        // `-webkit-text-security` sólo funciona en Chromium/Safari.
                        type="password"
                        value={value}
                      />
                    ))}
                  </div>

                  <p
                    aria-live="polite"
                    className={`mt-4 min-h-[20px] text-sm ${
                      status === "error" ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    {status === "error"
                      ? "Contraseña incorrecta. Probá de nuevo."
                      : status === "checking"
                        ? "Verificando…"
                        : ""}
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default SiteGateScreen
