import { getActiveTenant } from '@lib/site-config/active-tenant'
import { canonicalUrl } from '@lib/util/site-url'
import type { Metadata } from 'next'
import ContactForm from '@modules/contact/components/ContactForm'
import ContactMap from '@modules/contact/components/ContactMap'
import FaqAccordion from '@modules/contact/components/FaqAccordion'

// Multi-tenant por path (/demo/{slug}): render por request para leer x-demo-slug
// y resolver la config de contacto de la demo (dirección/teléfono/email). Sin
// esto se prerenderiza sin contexto de demo y muestra los datos del store default.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getActiveTenant()
  return {
    title: 'Contacto',
    // El sufijo de marca lo pone el `title.template` del root layout: repetirlo acá
    // emitía `Página | Marca | Marca`.
    alternates: { canonical: await canonicalUrl('/contact') },
    description: '¿En qué podemos ayudarte?',
  }
}

const PhoneIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-4 w-4 text-[--primary-color]'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z'
    />
  </svg>
)

const WhatsAppIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='currentColor'
    className='h-4 w-4 text-[--primary-color]'
    aria-hidden='true'
  >
    <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z' />
  </svg>
)

const EmailIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-4 w-4 text-[--primary-color]'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75'
    />
  </svg>
)

const LocationIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-4 w-4 text-[--primary-color]'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M15 10.5a3 3 0 11-6 0 3 3 0 016 0z'
    />
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z'
    />
  </svg>
)

const cardClass =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.06)]'

/**
 * Copy por defecto de la tarjeta "Atención al cliente".
 *
 * Venía del texto hardcodeado original, copiado tal cual — sin tildes incluido —
 * porque aquel ticket pedía hacerlo editable, no cambiar lo que se ve. DESDEELSUR-47
 * pide lo contrario: que el default también esté bien escrito, en castellano
 * rioplatense y con tildes, para la tienda que no configura nada. El cliente lo
 * sigue pudiendo reemplazar desde el backoffice; los placeholders del admin
 * (`demo-stores`, claves CONTENT_CONTACT_PAGE_*) son espejo de estas constantes.
 *
 * Ojo: son defaults de COPY DE UI, no datos del negocio. Teléfono, mail y
 * dirección NO tienen default — un dato de negocio que no está se OMITE, nunca se
 * inventa (el footer publicó un '+54 11 1234-5678' falso por hacer justo eso).
 */
const DEFAULT_SUPPORT_TITLE = 'Atención al cliente'
const DEFAULT_SUPPORT_DESCRIPTION =
  'Contanos qué necesitás y nuestro equipo te va a orientar con compras, envíos, stock o cualquier consulta sobre tu pedido.'
const DEFAULT_SUPPORT_NOTE =
  'Te recomendamos incluir tu número de pedido si tu consulta es sobre una compra ya realizada.'

export default async function ContactPage() {
  const tenant = await getActiveTenant()
  const contact = tenant.assets.contactPage
  const faq = tenant.assets.contactPage?.contactFaq ?? []
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? ''
  // Business contact data must come from the active tenant. A shared Mercatto
  // fallback leaks the wrong identity into every store that has not set email.
  const fallbackEmail = tenant.metadata?.contact?.email
  const fallbackPhone = tenant.metadata?.contact?.phone
  const hasContactMethods = Boolean(
    contact?.phone || contact?.whatsApp || contact?.email || fallbackEmail || fallbackPhone
  )
  /**
   * Copy editable desde el backoffice (`content_config.contactPage`). Se usa
   * `||` y no `??` a propósito: una cadena vacía o en blanco es "no lo
   * configuré", no "dejalo en blanco". El backend ya la descarta al emitir, pero
   * un valor escrito directo en la fila llegaría hasta acá.
   */
  const supportTitle = contact?.title?.trim() || DEFAULT_SUPPORT_TITLE
  const supportDescription =
    contact?.description?.trim() || DEFAULT_SUPPORT_DESCRIPTION
  const supportNote = contact?.note?.trim() || DEFAULT_SUPPORT_NOTE

  return (
    <section className='px-4 py-12 pb-20 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <h1 className='mb-10 text-left font-bold text-[#111827] text-3xl sm:text-4xl'>
          ¿En qué podemos ayudarte?
        </h1>

        <div className='grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]'>
          {/*
            Form. `self-start` es necesario: por defecto un item de grid es
            `align-self: stretch`, asi que la tarjeta del formulario crecia hasta
            igualar la altura de la COLUMNA derecha (atencion al cliente + mapa) y
            quedaba con un bloque de blanco muerto abajo. La columna derecha no
            sufre lo mismo porque es un flex-col: estirarla no estira sus hijos.
          */}
          <div className={`${cardClass} self-start`}>
            <ContactForm />
          </div>

          {/* Right column: two stacked cards */}
          <div className='flex flex-col gap-6'>
            {/* Contact methods */}
            <div className={cardClass}>
              <div>
                <p className='font-semibold text-[#111827] text-lg'>
                  {supportTitle}
                </p>
                <p className='mt-2 text-[#4B5563] text-sm leading-relaxed'>
                  {supportDescription}
                </p>

                <div className='mt-5'>
                  {contact?.phone && (
                    <div className='flex items-center gap-4 py-3'>
                      <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--mc-green-pale]'>
                        <PhoneIcon />
                      </div>
                      <div>
                        <p className='text-xs text-slate-400'>
                          {contact.phone.label}
                        </p>
                        <p className='font-medium text-[#4B5563] text-sm'>
                          {contact.phone.value}
                        </p>
                      </div>
                    </div>
                  )}

                  {!contact?.phone && fallbackPhone && (
                    <div className='flex items-center gap-4 py-3'>
                      <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--mc-green-pale]'>
                        <PhoneIcon />
                      </div>
                      <div>
                        <p className='text-xs text-slate-400'>Teléfono</p>
                        <p className='font-medium text-[#4B5563] text-sm'>
                          {fallbackPhone}
                        </p>
                      </div>
                    </div>
                  )}

                  {contact?.whatsApp && (
                    <div className='flex items-center gap-4 py-3'>
                      <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--mc-green-pale]'>
                        <WhatsAppIcon />
                      </div>
                      <div>
                        <p className='text-xs text-slate-400'>
                          {contact.whatsApp.label}
                        </p>
                        <p className='font-medium text-[#4B5563] text-sm'>
                          {contact.whatsApp.value}
                        </p>
                      </div>
                    </div>
                  )}

                  {contact?.email && (
                    <div className='flex items-center gap-4 py-3'>
                      <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--mc-green-pale]'>
                        <EmailIcon />
                      </div>
                      <div>
                        <p className='text-xs text-slate-400'>
                          {contact.email.label}
                        </p>
                        <p className='font-medium text-[#4B5563] text-sm'>
                          {contact.email.value}
                        </p>
                      </div>
                    </div>
                  )}

                  {!contact?.email && fallbackEmail && (
                    <div className='flex items-center gap-4 py-3'>
                      <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--mc-green-pale]'>
                        <EmailIcon />
                      </div>
                      <div>
                        <p className='text-xs text-slate-400'>Email</p>
                        <p className='font-medium text-[#4B5563] text-sm'>
                          {fallbackEmail}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {hasContactMethods && (
                  <div className='mt-5 rounded-xl bg-slate-50 px-4 py-3'>
                    <p className='font-medium text-[#111827] text-sm'>
                      {supportNote}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Location + Map */}
            {contact?.location && (
              <div className={cardClass}>
                {contact.location && (
                  <div className='flex items-start gap-4'>
                    <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--mc-green-pale]'>
                      <LocationIcon />
                    </div>
                    <div>
                      <p className='text-xs text-slate-400'>
                        {contact.location.label}
                      </p>
                      <p className='font-medium text-[#4B5563] text-sm leading-snug'>
                        {contact.location.value}
                      </p>
                    </div>
                  </div>
                )}

                {contact.location && (
                  <div className='mt-4 h-40 w-full overflow-hidden rounded-xl'>
                    <ContactMap
                      apiKey={googleMapsApiKey}
                      address={contact.location.value}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {faq.length > 0 && (
          <div className='mt-16'>
            <h2 className='mb-2 font-bold text-[#111827] text-2xl'>
              Preguntas frecuentes
            </h2>
            <FaqAccordion items={faq} />
          </div>
        )}
      </div>
    </section>
  )
}
