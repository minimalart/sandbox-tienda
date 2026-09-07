'use client'
import { Fragment, useState } from 'react'

type FaqItem = { question: string; answer: string }

function parseAnswer(text: string) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const [, linkText, href] = match
    const isExternal = href.startsWith('http')
    parts.push(
      <a
        key={match.index}
        href={href}
        className='underline text-[--primary-color] hover:opacity-80'
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {linkText}
      </a>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
      {items.map((item, idx) => {
        const isOpen = openIndex === idx
        return (
          <div
            key={idx}
            className={`rounded-2xl border bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all ${
              isOpen
                ? 'border-[--primary-color]'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <button
              type='button'
              className='flex w-full items-center justify-between gap-4 px-5 py-4 text-left'
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              aria-expanded={isOpen}
            >
              <span className='font-semibold text-[#374151]'>
                {item.question}
              </span>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>
            {isOpen && (
              <div className='px-5 pb-5 text-slate-600 text-sm leading-relaxed'>
                {item.answer.split('\n').map((line, lineIdx) => (
                  <Fragment key={lineIdx}>
                    {lineIdx > 0 && <br />}
                    {parseAnswer(line)}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
