import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildLegalToc } from './anchors.ts'

/** Sólo `name` importa acá; `id` y `html` van para completar el tipo. */
const s = (name: string) => ({ id: name, name, html: '<p>x</p>' })

describe('buildLegalToc', () => {
  it('deriva el ancla del nombre, sin tildes ni signos', () => {
    const toc = buildLegalToc([
      s('Información que recopilamos'),
      s('Precios, facturación y medios de pago'),
    ])
    assert.deepEqual(
      toc.map((e) => e.anchor),
      ['informacion-que-recopilamos', 'precios-facturacion-y-medios-de-pago'],
    )
  })

  it('el signo de apertura no deja un guion adelante', () => {
    // `¿Cómo gestionar el cambio?` es una sección REAL del default: sin el recorte de
    // guiones en los bordes el ancla saldría `-como-gestionar-el-cambio-`.
    const [entry] = buildLegalToc([s('¿Cómo gestionar el cambio?')])
    assert.equal(entry.anchor, 'como-gestionar-el-cambio')
  })

  it('conserva el nombre tal cual lo escribió el operador', () => {
    const [entry] = buildLegalToc([s('Tus derechos')])
    assert.equal(entry.name, 'Tus derechos')
  })

  it('desempata los nombres repetidos', () => {
    // Nada impide dos secciones llamadas igual, y con anclas repetidas el índice
    // mandaría los dos ítems al mismo panel: dos links que van al mismo lugar se
    // reportan como bug, un `-2` no.
    const toc = buildLegalToc([s('Excepciones'), s('Excepciones'), s('Excepciones')])
    assert.deepEqual(
      toc.map((e) => e.anchor),
      ['excepciones', 'excepciones-2', 'excepciones-3'],
    )
  })

  it('un nombre sin caracteres usables cae a su posición', () => {
    // Sin esto el ancla queda vacía y el `href="#"` no navega a ningún lado.
    const toc = buildLegalToc([s('Uno'), s('•••'), s('¿?')])
    assert.deepEqual(
      toc.map((e) => e.anchor),
      ['uno', 'seccion-2', 'seccion-3'],
    )
  })

  it('mantiene el orden del array', () => {
    const toc = buildLegalToc([s('Tercera'), s('Primera'), s('Segunda')])
    assert.deepEqual(
      toc.map((e) => e.name),
      ['Tercera', 'Primera', 'Segunda'],
    )
  })

  it('sin secciones devuelve un índice vacío', () => {
    assert.deepEqual(buildLegalToc([]), [])
  })
})
