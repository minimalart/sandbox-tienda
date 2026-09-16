import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recipientWording, usesQuickViewOnly } from './template-helpers';

describe('campaign product browsing and recipient copy', () => {
  it('limits quick-view-only browsing to campaign', () => {
    assert.equal(usesQuickViewOnly('campaign'), true);
    for (const template of [undefined, 'grocery', 'sports', 'fashion'] as const) {
      assert.equal(usesQuickViewOnly(template), false);
    }
  });

  it('uses estudiante with singular, plural and matching articles', () => {
    const cases = [
      ['Destinatarios de productos', 'Estudiantes de productos'],
      ['Seleccioná una persona', 'Seleccioná un estudiante'],
      ['Una persona para toda la compra', 'Un estudiante para toda la compra'],
      ['Reutilizá la persona ya cargada.', 'Reutilizá el estudiante ya cargado.'],
      ['Seleccioná una persona válida.', 'Seleccioná un estudiante válido.'],
      ['Hay una persona repetida.', 'Hay un estudiante repetido.'],
      ['2 personas · 3 unidades', '2 estudiantes · 3 unidades'],
      ['Nombre del alumno', 'Nombre del estudiante'],
      ['Datos personales', 'Datos personales'],
    ];
    for (const [input, expected] of cases) {
      assert.equal(recipientWording(input, 'campaign'), expected);
      for (const template of [undefined, 'grocery', 'sports'] as const) {
        assert.equal(recipientWording(input, template), input);
      }
    }
  });
});
