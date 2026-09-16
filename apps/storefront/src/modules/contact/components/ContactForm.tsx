'use client'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from "@lib/util/zod-resolver"
import FormInput from '@modules/common/components/form-input'
import PhoneInput from '@modules/common/components/phone-input'
import Textarea from '@modules/common/components/textarea'
import { PlaneFlight } from '@modules/common/components/plane-button'
import { useContactForm } from '@lib/hooks/use-contact-form'
import { useUtm } from '@lib/hooks/use-utm'
import { extractPhoneParts } from '@lib/util/phone'
import { type ContactInput, contactSchema } from '@lib/validation/contact'
import { CheckCircle, X } from 'lucide-react'

const SendIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-4 w-4'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5'
    />
  </svg>
)

const errorClass = 'mt-1 text-xs text-red-500'

export default function ContactForm() {
  const { isLoading, error, success, fieldErrors, submit, reset } =
    useContactForm()
  const { getUtm } = useUtm()

  const {
    register,
    control,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: 'onTouched',
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      message: '',
      honeypot: '',
    },
  })

  const onSubmit = async (data: ContactInput) => {
    const { dialCode, nationalNumber } = extractPhoneParts(data.phone)
    const phoneProvided = nationalNumber.length > 0

    const utm = getUtm()
    const utmData = Object.keys(utm).length > 0 ? utm : null

    const result = await submit({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      message: data.message,
      honeypot: data.honeypot ?? '',
      phone_area: phoneProvided ? dialCode : null,
      phone: phoneProvided ? nationalNumber : null,
      utm_data: utmData,
    })
    if (result.success) {
      resetForm()
    }
  }

  // Error visible por campo: validación de Zod/RHF O error devuelto por el server.
  const firstNameError = errors.first_name?.message || fieldErrors.first_name
  const lastNameError = errors.last_name?.message || fieldErrors.last_name
  const emailError = errors.email?.message || fieldErrors.email
  const phoneError = errors.phone?.message || fieldErrors.phone
  const messageError = errors.message?.message || fieldErrors.message

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className='flex flex-col'
    >
      {/* Honeypot */}
      <input
        className='hidden'
        tabIndex={-1}
        type='text'
        autoComplete='off'
        {...register('honeypot')}
      />

      {success && (
        <div className='mb-5 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3'>
          <CheckCircle className='h-5 w-5 shrink-0 text-green-600' />
          <p className='flex-1 text-green-800 text-sm'>
            ¡Mensaje enviado! Nos pondremos en contacto a la brevedad.
          </p>
          <button
            type='button'
            onClick={reset}
            className='shrink-0 text-green-600 hover:text-green-800'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
      )}

      {error && (
        <div className='mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3'>
          <p className='text-red-700 text-sm'>{error}</p>
        </div>
      )}

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div>
          <FormInput
            label='Nombre'
            id='first_name'
            type='text'
            placeholder='Ej: Juan'
            autoComplete='given-name'
            required
            hasError={!!firstNameError}
            {...register('first_name')}
          />
          {firstNameError && <p className={errorClass}>{firstNameError}</p>}
        </div>

        <div>
          <FormInput
            label='Apellido'
            id='last_name'
            type='text'
            placeholder='Ej: Pérez'
            autoComplete='family-name'
            required
            hasError={!!lastNameError}
            {...register('last_name')}
          />
          {lastNameError && <p className={errorClass}>{lastNameError}</p>}
        </div>

        <div>
          <FormInput
            label='Correo electrónico'
            id='email'
            type='email'
            placeholder='ejemplo@correo.com'
            autoComplete='email'
            required
            hasError={!!emailError}
            {...register('email')}
          />
          {emailError && <p className={errorClass}>{emailError}</p>}
        </div>

        <div>
          <Controller
            control={control}
            name='phone'
            render={({ field }) => (
              <PhoneInput
                label='Celular'
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder='Ej: +54 9 11 1234-5678'
                hasError={!!phoneError}
              />
            )}
          />
          {phoneError && <p className={errorClass}>{phoneError}</p>}
        </div>
      </div>

      <div className='mt-4'>
        <Textarea
          label='Mensaje'
          id='message'
          rows={7}
          placeholder='Ej: Quería consultar por...'
          required
          hasError={!!messageError}
          {...register('message')}
        />
        {messageError && <p className={errorClass}>{messageError}</p>}
      </div>

      {/*
        Sin `mt-auto`: junto con el `h-full` del form, empujaba el boton al piso
        de la tarjeta y abria un hueco blanco entre el textarea y el boton cuando
        la columna derecha era mas alta. El boton tiene que seguir al textarea.
      */}
      <div className='flex justify-center pt-6'>
        <button
          type='submit'
          disabled={isLoading || success}
          className='relative inline-flex min-h-[44px] items-center gap-2 overflow-hidden rounded-xl bg-[--primary-color] px-10 py-3 font-sans font-semibold text-base text-white transition-colors hover:bg-[--primary-color-dark] disabled:cursor-not-allowed disabled:opacity-50'
        >
          <PlaneFlight isSuccess={success} successLabel='¡Enviado!'>
            <SendIcon />
            {isLoading ? 'Enviando...' : 'Enviá tu consulta'}
          </PlaneFlight>
        </button>
      </div>
    </form>
  )
}
