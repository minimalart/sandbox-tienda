import assert from 'node:assert/strict';
import { it } from 'node:test';
import { goToCheckoutStep, isCheckoutStepEditing, nextVisibleStep } from './checkout-step';

it('preserves explicit editing through remounts and clears it on continue for every checkout step', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  for (const pathname of ['/tienda/marianista/checkout', '/ar/checkout', '/ar/b2b/checkout']) {
    let location = new URL(pathname, 'https://example.com');
    const navigate = (_data: unknown, _unused: string, url: string) => {
      location = new URL(url, location);
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      location,
      history: { pushState: navigate, replaceState: navigate },
    } });
    try {
      for (const step of ['personal', 'address', 'delivery', 'billing', 'recipients', 'benefits', 'payment']) {
        goToCheckoutStep(step, { editing: true });
        assert.equal(location.pathname, pathname);
        const requested = location.searchParams.get('step')!;
        assert.equal(requested, `edit-${step}`);
        // A remounted form starts with an empty submitted-step history.
        assert.equal(isCheckoutStepEditing(requested, step, step, new Set()), true);
        goToCheckoutStep('review');
        assert.equal(location.searchParams.get('step'), 'review');
        assert.equal(isCheckoutStepEditing('review', 'review', step), false);
      }
    } finally {
      if (original) Object.defineProperty(globalThis, 'window', original);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

it('keeps first visits normal and does not label prerequisite redirects as editing', () => {
  assert.equal(isCheckoutStepEditing('personal', 'personal', 'personal'), false);
  assert.equal(isCheckoutStepEditing('edit-payment', 'personal', 'personal'), false);
  assert.equal(isCheckoutStepEditing('edit-payment', 'personal', 'payment'), false);
  assert.equal(isCheckoutStepEditing('personal', 'personal', 'personal', new Set(['personal'])), true);
  assert.equal(isCheckoutStepEditing('recipients', 'recipients', 'personal', new Set(['personal'])), false);
});

it('advances to the next VISIBLE step, never to one the policy hid', () => {
  // Tienda que retira en el colegio: la policy oculta `address` y `delivery`.
  const pickupOnly = ['personal', 'recipients', 'payment'];
  assert.equal(nextVisibleStep(pickupOnly, 'personal', 'address'), 'recipients');
  assert.equal(nextVisibleStep(pickupOnly, 'recipients'), 'payment');
  // Con envío a domicilio el orden completo sigue funcionando igual.
  const fullFlow = ['personal', 'address', 'delivery', 'benefits', 'payment'];
  assert.equal(nextVisibleStep(fullFlow, 'personal', 'address'), 'address');
  assert.equal(nextVisibleStep(fullFlow, 'delivery', 'payment'), 'benefits');
  // `edit-` es intención de URL, no un paso aparte.
  assert.equal(nextVisibleStep(fullFlow, 'edit-personal'), 'address');
  // Último paso y pasos fuera del orden caen en el fallback (o undefined).
  assert.equal(nextVisibleStep(fullFlow, 'payment'), undefined);
  assert.equal(nextVisibleStep(pickupOnly, 'billing'), undefined);
  assert.equal(nextVisibleStep(pickupOnly, 'billing', 'payment'), 'payment');
});
