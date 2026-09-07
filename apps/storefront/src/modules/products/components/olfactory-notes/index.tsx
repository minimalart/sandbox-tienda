const OLFACTORY_NOTE_FIELDS = [
  { key: 'note_output', label: 'Notas de salida' },
  { key: 'note_heart', label: 'Notas de corazón' },
  { key: 'note_background', label: 'Notas de fondo' },
] as const

type OlfactoryNotesProps = {
  metadata: Record<string, unknown> | null | undefined
}

const OlfactoryNotes = ({ metadata }: OlfactoryNotesProps) => {
  const notes = metadata
    ? OLFACTORY_NOTE_FIELDS.map((field) => ({
        label: field.label,
        value:
          typeof metadata[field.key] === 'string'
            ? (metadata[field.key] as string).trim()
            : '',
      })).filter((n) => n.value)
    : []

  if (notes.length === 0) return null

  return (
    <div className='w-full mt-12 rounded-xl border border-gray-200 bg-white'>
      <h2 className='p-4 font-semibold text-gray-900 text-sm sm:p-5'>
        Notas Olfativas
      </h2>
      <div className='rounded-b-xl border-gray-100 border-t bg-grey-5 p-4 sm:p-5'>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          {notes.map((note) => (
            <div key={note.label}>
              <p className='font-medium text-gray-800 text-xs sm:text-sm'>
                {note.label}
              </p>
              <p className='mt-1 text-gray-500 text-xs sm:text-sm'>
                {note.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default OlfactoryNotes
