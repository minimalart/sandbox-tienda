import type { ReactNode } from 'react'

const DefaultSectionIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.8'
    className='h-4 w-4 text-slate-500'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M7.5 3.75h6.879a2.25 2.25 0 011.591.659l1.621 1.621a2.25 2.25 0 01.659 1.591V18a2.25 2.25 0 01-2.25 2.25h-8.5A2.25 2.25 0 015.25 18V6A2.25 2.25 0 017.5 3.75z'
    />
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M14.25 3.75V7.5a.75.75 0 00.75.75h3.75'
    />
  </svg>
)

type LegalCardProps = {
  title?: string
  children: ReactNode
  className?: string
  sectionId?: string
  icon?: ReactNode
  isIcon?: boolean
}

export default function LegalCard({
  title,
  children,
  className = '',
  sectionId,
  icon,
  isIcon = true,
}: LegalCardProps) {
  return (
    <section
      id={sectionId}
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ${className}`}
    >
      {title && (
        <div className='mb-3 flex items-center gap-2'>
          {isIcon && (icon ?? <DefaultSectionIcon />)}
          <h2 className='font-bold text-[#18324A] text-[20px] leading-none'>
            {title}
          </h2>
        </div>
      )}

      <div className='space-y-4 text-[16px] leading-7 text-slate-600'>
        {children}
      </div>
    </section>
  )
}
