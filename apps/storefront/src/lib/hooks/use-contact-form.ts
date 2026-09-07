'use client'

import { useCallback, useState } from 'react'
import type { UtmParams } from '@lib/util/utm'

export interface ContactFormData {
  first_name: string
  last_name: string
  email: string
  phone_area: string | null
  phone: string | null
  message: string
  honeypot: string
  utm_data?: UtmParams | null
}

export function useContactForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  // Validación de cliente: la hace Zod/RHF en el componente.
  // Estos son errores por campo que devuelve el SERVIDOR.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const submit = useCallback(async (data: ContactFormData) => {
    setError(null)
    setFieldErrors({})

    setIsLoading(true)
    setSuccess(false)

    try {
      const response = await fetch('/api/store/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.message || 'Error al enviar el mensaje')
        if (result.fieldErrors && typeof result.fieldErrors === 'object') {
          setFieldErrors(result.fieldErrors)
        }
        return { success: false }
      }

      setSuccess(true)
      return { success: true }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión')
      return { success: false }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setSuccess(false)
    setFieldErrors({})
  }, [])

  return { isLoading, error, success, fieldErrors, submit, reset }
}
