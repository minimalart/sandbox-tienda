/**
 * Cambios y devoluciones — la versión HARDCODEADA, tal como se venía publicando.
 *
 * FALLBACK, no la fuente: la página real lee el texto del backoffice
 * (`lib/data/legal-pages.ts`). Esto se renderiza sólo cuando el backend no contesta —
 * un release escalonado donde el storefront ya tiene la ruta y el backend todavía no,
 * el backend caído, o la publishable key mal configurada. Servir el texto de siempre
 * es preferible a publicar una página legal en blanco.
 *
 * Se puede BORRAR cuando el backend con `GET /store/store-config/legal-pages` esté
 * desplegado en todos los proyectos, igual que el fallback de rutas de
 * `lib/site-config/active-tenant.ts`. Hasta entonces, el texto por defecto de verdad
 * es el de `apps/backend/src/modules/store-config/legal/defaults.ts`: si hay que
 * corregir el copy, se corrige ALLÁ.
 */
import LegalCard from '../legalCard';
import Link from 'next/link'

const ChatIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-5 w-5 text-slate-500'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z'
    />
  </svg>
)

const TruckIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-5 w-5 text-slate-500'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12'
    />
  </svg>
)

const ClockIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-5 w-5 text-slate-500'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'
    />
  </svg>
)

const EmailIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-4 w-4 shrink-0 text-slate-500'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75'
    />
  </svg>
)

const PhoneIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-4 w-4 shrink-0 text-slate-500'
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
    className='h-4 w-4 shrink-0 text-slate-500'
    aria-hidden='true'
  >
    <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z' />
  </svg>
)

export default function HardcodedExchangesAndReturns() {
  return (
    <section className='border-[#B5B5B5] border-b-[0.5px] border-gray-900/10 px-4 py-8 pb-20 sm:px-6 lg:px-8'>
      <div className='mx-auto flex max-w-7xl flex-col gap-14'>
        <div>
          <h1 className='mb-6 font-bold text-[#18324A] text-3xl sm:text-4xl'>
            Cambios y devoluciones
          </h1>
          <div className='grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]'>
            <LegalCard>
              <p>
                Podés devolver tu compra realizada en nuestra tienda online,{' '}
                <strong>
                  en un plazo de 10 (diez) días desde la fecha de recepción del
                  paquete
                </strong>{' '}
                y te reembolsaremos el importe total. Si la devolución se
                realiza fuera de este periodo o el artículo se ha utilizado,
                estropeado o no se envía en su embalaje original, no aceptaremos
                la devolución y no se podrá reembolsar el pago. Recordá que al
                momento de la entrega deberás revisar el buen estado de los
                productos antes de firmar el remito de entrega. La devolución
                será aceptada únicamente con productos del mismo pedido. No se
                aceptarán devoluciones de productos adquiridos en otros canales
                o realizados en fechas anteriores al pedido a devolver.
              </p>
            </LegalCard>

            <LegalCard title='Restricciones' isIcon={false}>
              <p>
                No se aceptarán cambios y devoluciones de los productos que se
                encuentren:
              </p>
              <ul
                className='list-disc list-inside space-y-1'
                style={{ marginTop: 0 }}
              >
                <li>Usados</li>
                <li>Sin su envase y/o envoltorio original</li>
                <li>
                  Sin el comprobante de cambio o devolución generado por el
                  Centro de Atención al cliente
                </li>
              </ul>
            </LegalCard>
          </div>
        </div>

        <div>
          <h2 className='mb-6 font-bold text-[#18324A] text-center text-3xl sm:text-4xl'>
            ¿Cómo gestionar el cambio?
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
            <LegalCard title='Paso 1' icon={<ChatIcon />}>
              <p>
                Comunícate con nuestro Centro de Atención al Cliente para
                comenzar el trámite de tu devolución. Ellos te indicarán si tu
                solicitud es autorizada de acuerdo a nuestra política de
                devoluciones.
              </p>
            </LegalCard>

            <LegalCard title='Paso 2' icon={<TruckIcon />}>
              <p>
                Si tu solicitud es autorizada, programaremos al retiro del
                pedido en la dirección que nos indiques. Asegúrate de empacar
                los artículos en su embalaje original.
              </p>
            </LegalCard>

            <LegalCard title='Paso 3' icon={<ClockIcon />}>
              <p>
                Primero deberás devolver el producto original para recibir el
                nuevo producto o el reembolso correspondiente.
              </p>
            </LegalCard>
          </div>
        </div>

        <div>
          <h2 className='mb-6 font-bold text-[#18324A] text-center text-3xl sm:text-4xl'>
            Centro de atención al cliente
          </h2>
          <LegalCard>
            <p>
              Para dudas o consultas, podés escribirnos a través de nuestro{' '}
              <Link
                href='/contact'
                className='underline text-[#18324A] hover:opacity-70'
              >
                formulario de contacto
              </Link>{' '}
              o comunicarte con nuestro Centro de Atención al Cliente Mercatto
              en cualquiera de los canales detallados a continuación:
            </p>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2'>
              <div className='flex items-center gap-2'>
                <EmailIcon />
                <span>tienda@ejemplo.com.ar</span>
              </div>
              <div className='flex items-center gap-2'>
                <PhoneIcon />
                <span>(011) 4762-6226</span>
              </div>
              <div className='flex items-center gap-2'>
                <WhatsAppIcon />
                <span>(011) 4762-6226</span>
              </div>
            </div>
          </LegalCard>
        </div>
      </div>
    </section>
  )
}
