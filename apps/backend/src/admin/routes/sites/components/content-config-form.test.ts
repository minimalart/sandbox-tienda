import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DemoContentConfig } from '../../../hooks/api';
import {
  contentConfigToForm,
  emptyContentForm,
  formToContentConfig,
} from './content-config-form';

/**
 * `formToContentConfig` RECONSTRUYE `content_config` desde cero, y
 * `POST /admin/sites/{id}` REEMPLAZA la columna JSON entera. La combinación es la
 * que borró el footer en silencio: toda clave que la ficha no modele y no arrastre
 * desaparece al guardar, sin error. Estos tests son el candado de ese arrastre.
 */
describe('formToContentConfig — arrastra lo que la ficha no modela', () => {
  const current: DemoContentConfig = {
    description: 'Descripción de SEO de la tienda',
    footer: {
      description: 'El párrafo bajo el logo',
      social: [{ name: 'Instagram', href: 'https://instagram.com/x', icon: 'instagram' }],
      legal: [{ name: 'Términos', href: '/legal/terminos' }],
      newsletter: { title: 'Suscribite', buttonText: 'Enviar' },
      copyright: '© {year} La Tienda',
    },
    contactPage: { title: 'Atención al cliente' },
  } as DemoContentConfig;

  it('no toca el footer: lo devuelve tal cual vino del server', () => {
    const cfg = formToContentConfig(emptyContentForm(), 'main', current);
    assert.deepEqual(cfg.footer, current.footer);
  });

  it('conserva la descripción de SEO, que ninguna pantalla de la ficha edita', () => {
    const cfg = formToContentConfig(emptyContentForm(), 'main', current);
    assert.equal(cfg.description, 'Descripción de SEO de la tienda');
  });

  it('omite `footer` si el server no traía ninguno (un `{}` ganaría sobre el del template)', () => {
    const cfg = formToContentConfig(emptyContentForm(), 'main', {});
    assert.equal('footer' in cfg, false);
  });

  it('sin `current` (alta de tienda) tampoco inventa un footer', () => {
    const cfg = formToContentConfig(emptyContentForm(), 'main');
    assert.equal('footer' in cfg, false);
  });
});

describe('formToContentConfig — el contacto sí lo modela la ficha', () => {
  it('el horario sale del formulario, no del `current`', () => {
    const form = { ...emptyContentForm(), contactHours: 'Lun a Vie de 9 a 17 hs' };
    const cfg = formToContentConfig(form, 'main', {
      contact: { hours: 'Lun a Vie de 8 a 18 hs' },
    } as DemoContentConfig);
    assert.equal(cfg.contact?.hours, 'Lun a Vie de 9 a 17 hs');
  });

  it('vaciar un dato de contacto lo BORRA — no se resucita del `current`', () => {
    const cfg = formToContentConfig(emptyContentForm(), 'main', {
      contact: { phone: '+54 11 1234-5678', hours: 'Lun a Vie de 8 a 18 hs' },
    } as DemoContentConfig);
    assert.equal('contact' in cfg, false);
  });

  it('emite los cuatro datos juntos', () => {
    const cfg = formToContentConfig(
      {
        ...emptyContentForm(),
        contactAddress: 'Av. Corrientes 1234',
        contactPhone: '+54 11 1234-5678',
        contactEmail: 'hola@tienda.com',
        contactHours: 'Lun a Vie de 8 a 18 hs',
      },
      'main',
    );
    assert.deepEqual(cfg.contact, {
      address: 'Av. Corrientes 1234',
      phone: '+54 11 1234-5678',
      email: 'hola@tienda.com',
      hours: 'Lun a Vie de 8 a 18 hs',
    });
  });
});

describe('contentConfigToForm', () => {
  it('siembra el horario desde `contact.hours`', () => {
    const form = contentConfigToForm({
      contact: { hours: 'Sáb de 9 a 13 hs' },
    } as DemoContentConfig);
    assert.equal(form.contactHours, 'Sáb de 9 a 13 hs');
  });

  it('ida y vuelta: guardar sin tocar nada no cambia el contacto ni el footer', () => {
    const cfg: DemoContentConfig = {
      contact: {
        address: 'Av. Corrientes 1234',
        phone: '+54 11 1234-5678',
        email: 'hola@tienda.com',
        hours: 'Lun a Vie de 8 a 18 hs',
      },
      footer: { description: 'Bajo el logo', copyright: '© {year}' },
    } as DemoContentConfig;
    const out = formToContentConfig(contentConfigToForm(cfg), 'main', cfg);
    assert.deepEqual(out.contact, cfg.contact);
    assert.deepEqual(out.footer, cfg.footer);
  });
});
