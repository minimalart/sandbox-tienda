import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  copyrightLine,
  storeDisplayName,
  subjectWithStore,
} from './templates/email-helpers';

import { customerRegisterTemplate } from './templates/customer-register';
import { passwordResetTemplate } from './templates/password-reset';
import { inviteTemplate } from './templates/invite';
import { orderCancelledTemplate } from './templates/order-cancelled';
import { orderTrackingTemplate } from './templates/order-tracking';
import { orderNotificationAdminTemplate } from './templates/order-notification-admin';
import { quotationNotificationAdminTemplate } from './templates/quotation-notification-admin';
import { quotationRejectedAdminTemplate } from './templates/quotation-rejected-admin';
import { orderReadyForPickupTemplate } from './templates/order-ready-for-pickup';
import { b2bClientApprovedTemplate } from './templates/b2b-client-approved';
import { kitCdeNotificationTemplate } from './templates/kit-cde-notification';
import { orderTransferRequestTemplate } from './templates/order-transfer-request';
import { templates } from './templates';

/**
 * LA MARCA AJENA EN LOS MAILS.
 *
 * Doce plantillas resolvían su nombre visible con `|| 'Mercatto'` y armaban el
 * asunto con `channelName ? \`[${channelName}] …\` : \`[Mercatto] …\``. El
 * camino del `else` NO es teórico: `email_branding.cde_display_name` arranca en
 * `null` (ver `EMAIL_BRANDING_DEFAULTS` en store-config) y el servicio lo
 * inyecta tal cual, así que una tienda que nunca completó su branding le
 * mandaba a SUS clientes un mail encabezado, firmado y con el asunto de otra.
 *
 * Lo que se prueba acá es una sola regla, en las dos direcciones:
 *
 *   1. con tienda conocida, la tienda aparece;
 *   2. sin tienda conocida, NO aparece ninguna marca — ni en el asunto, ni en
 *      el cuerpo, ni en el pie.
 *
 * El punto 2 es el que importa. Ninguno de estos mails rompe nada al fallar:
 * salen igual, bien formados, firmados por el cliente equivocado.
 */

const BRAND = 'Mercatto';

/** Las doce plantillas, con el mínimo de datos para que rendericen. */
const TEMPLATES: Array<{
  name: string;
  render: (data: Record<string, unknown>) => { subject: string; html: string };
  /** Asunto pelado esperado, sin prefijo de tienda. */
  bareSubject: string;
}> = [
  {
    name: 'customer-register',
    render: (d) => customerRegisterTemplate({ email: 'ana@example.com', ...d } as never),
    bareSubject: 'Confirmación de registro',
  },
  {
    name: 'password-reset',
    render: (d) => passwordResetTemplate({ link_reseteo: 'https://x.test/r', ...d } as never),
    bareSubject: 'Restablecer tu contraseña',
  },
  {
    name: 'admin-invite',
    render: (d) => inviteTemplate({ link_invitacion: 'https://x.test/i', ...d } as never),
    // El asunto de la invitación nombra la tienda adentro: se prueba aparte.
    bareSubject: null as unknown as string,
  },
  {
    name: 'order-cancelled',
    render: (d) => orderCancelledTemplate({ display_id: 1234, ...d } as never),
    bareSubject: 'Tu pedido fue cancelado #1234',
  },
  {
    name: 'order-tracking',
    render: (d) =>
      orderTrackingTemplate({
        display_id: 1234,
        current_milestone: 'payment_confirmed',
        ...d,
      } as never),
    bareSubject: null as unknown as string, // el asunto depende del milestone
  },
  {
    name: 'order-notification-admin',
    render: (d) => orderNotificationAdminTemplate({ display_id: 1234, ...d } as never),
    bareSubject: null as unknown as string,
  },
  {
    name: 'quotation-notification-admin',
    render: (d) => quotationNotificationAdminTemplate({ display_id: 1234, ...d } as never),
    bareSubject: null as unknown as string,
  },
  {
    name: 'quotation-rejected-admin',
    render: (d) => quotationRejectedAdminTemplate({ display_id: 1234, ...d } as never),
    bareSubject: null as unknown as string,
  },
  {
    name: 'order-ready-for-pickup',
    render: (d) => orderReadyForPickupTemplate({ display_id: 1234, ...d } as never),
    bareSubject: 'Tu pedido #1234 ya está listo para retirar',
  },
  {
    name: 'b2b-client-approved',
    render: (d) => b2bClientApprovedTemplate({ email: 'ana@example.com', ...d } as never),
    bareSubject: '¡Tu registro fue aprobado!',
  },
  {
    // Estaba escrita entera alrededor de una marca: el logo salía de
    // `cde-logos/mercatto.png`, los colores de dos constantes `MERCATTO_COLOR`
    // y el pie firmaba `© 2026 Mercatto` sin variable ninguna.
    name: 'kit-cde-notification',
    render: (d) => kitCdeNotificationTemplate({ order_display_id: 1234, ...d } as never),
    bareSubject: 'Nuevo pedido para preparar — Kit #1234',
  },
  {
    // Llegó con el bug puesto en el PR #1193, ya mergeado a main: es una copia
    // del molde de `customer-register`, con el `|| 'Mercatto'` incluido.
    name: 'order-transfer-request',
    render: (d) => orderTransferRequestTemplate({ display_id: 1234, ...d } as never),
    bareSubject: 'Vincular el pedido #1234 a una cuenta',
  },
];

// ─── Sin tienda conocida: ninguna marca, en ningún lado ───────────────────────

for (const { name } of TEMPLATES) {
  test(`${name}: sin tienda, la marca no aparece en el asunto`, () => {
    const { subject } = TEMPLATES.find((t) => t.name === name)!.render({});
    assert.ok(
      !subject.includes(BRAND),
      `el asunto de ${name} nombra "${BRAND}" sin saber de qué tienda es: ${subject}`
    );
    // Y tampoco un corchete vacío, que era el otro final posible.
    assert.ok(!subject.includes('[]'), `el asunto de ${name} sale con corchetes vacíos: ${subject}`);
    assert.ok(!subject.startsWith('['), `el asunto de ${name} abre un prefijo sin tienda: ${subject}`);
  });

  test(`${name}: sin tienda, la marca no aparece en el cuerpo`, () => {
    const { html } = TEMPLATES.find((t) => t.name === name)!.render({});
    assert.ok(
      !html.includes(BRAND),
      `el cuerpo de ${name} nombra "${BRAND}" sin saber de qué tienda es`
    );
  });

  test(`${name}: sin tienda, el pie no queda con la firma colgando`, () => {
    const { html } = TEMPLATES.find((t) => t.name === name)!.render({});
    const year = new Date().getFullYear();
    // El bug de rellenar con '' en vez de omitir: "© 2026 . Todos los…".
    assert.ok(
      !html.includes(`© ${year} .`),
      `el pie de ${name} deja el espacio de la firma vacío`
    );
    assert.ok(!html.includes('©  '), `el pie de ${name} deja doble espacio tras el ©`);
  });

  test(`${name}: sin tienda ni logo, no queda un título vacío en la cabecera`, () => {
    const { html } = TEMPLATES.find((t) => t.name === name)!.render({});
    // La cabecera se OMITE; no se rellena con un div de 24px sin texto.
    assert.ok(
      !/font-size:\s?24px;\s?font-weight:\s?700;[^>]*><\/div>/.test(html),
      `${name} renderiza el título de marca vacío en vez de omitirlo`
    );
  });
}

// ─── Con tienda conocida: la tienda SÍ aparece ───────────────────────────────

for (const { name, bareSubject } of TEMPLATES) {
  test(`${name}: con tienda conocida, el asunto lleva su prefijo`, () => {
    const { subject } = TEMPLATES.find((t) => t.name === name)!.render({
      cde_display_name: 'Desde el Sur',
    });
    assert.ok(
      subject.startsWith('[Desde el Sur] '),
      `el asunto de ${name} perdió el prefijo de la tienda: ${subject}`
    );
    if (bareSubject) {
      assert.equal(subject, `[Desde el Sur] ${bareSubject}`);
    }
  });

  test(`${name}: con tienda conocida, el pie la firma`, () => {
    const { html } = TEMPLATES.find((t) => t.name === name)!.render({
      cde_display_name: 'Desde el Sur',
    });
    // b2b-client-approved no lleva pie de copyright; en las demás tiene que estar.
    if (name === 'b2b-client-approved') {
      assert.ok(html.includes('Desde el Sur'), 'la cabecera tiene que nombrar la tienda');
      return;
    }
    const year = new Date().getFullYear();
    assert.ok(
      html.includes(`© ${year} Desde el Sur. Todos los derechos reservados.`),
      `el pie de ${name} no firma con la tienda`
    );
  });

  test(`${name}: sin logo, la tienda encabeza el mail`, () => {
    const { html } = TEMPLATES.find((t) => t.name === name)!.render({
      cde_display_name: 'Desde el Sur',
    });
    assert.ok(html.includes('Desde el Sur'), `${name} no muestra el nombre de la tienda`);
  });
}

// ─── La invitación, que nombra la tienda DENTRO del asunto y del título ──────

test('admin-invite: con tienda, el asunto y el título la nombran', () => {
  const { subject, html } = inviteTemplate({
    link_invitacion: 'https://x.test/i',
    cde_display_name: 'Desde el Sur',
  } as never);
  assert.equal(subject, '[Desde el Sur] Te invitaron a administrar Desde el Sur');
  assert.ok(html.includes('Te invitaron al panel de Desde el Sur'));
});

test('admin-invite: sin tienda, el texto va en genérico y no queda colgando', () => {
  // Acá el nombre no era sólo un prefijo: encabezaba el <h1>. Vaciarlo daba
  // "Te invitaron al panel de " con la preposición al aire.
  const { subject, html } = inviteTemplate({ link_invitacion: 'https://x.test/i' } as never);
  assert.equal(subject, 'Te invitaron a administrar la tienda');
  assert.ok(html.includes('Te invitaron al panel de administración'));
  assert.ok(!html.includes('Te invitaron al panel de <'), 'el título quedó sin sujeto');
  assert.ok(!html.includes('administrar </'), 'el asunto quedó sin sujeto');
});

// ─── El caso puntual del soporte hardcodeado ─────────────────────────────────

test('b2b-client-approved ya no manda a escribirle al soporte de otra empresa', () => {
  // Estaba en el CUERPO, sin variable ni fallback: "¿Necesitás ayuda?
  // Contactanos en soporte@mercatto.com". Un cliente de otra tienda que
  // respondía a ese mail le escribía a una casilla que no es de su proveedor.
  const { html } = b2bClientApprovedTemplate({
    email: 'ana@example.com',
    cde_display_name: 'Desde el Sur',
  } as never);
  assert.ok(!html.includes('soporte@mercatto.com'), 'sigue el mail de soporte hardcodeado');
  assert.ok(!html.includes('mailto:soporte@'), 'sigue un mailto de soporte hardcodeado');
  // El cierre genérico que sí queda no nombra ninguna casilla.
  assert.ok(html.includes('equipo de soporte'), 'se perdió la referencia genérica al soporte');
});

// ─── La red para la próxima copia ────────────────────────────────────────────

test('NINGUNA plantilla del registro nombra una marca cuando no sabe la tienda', () => {
  /**
   * Este test existe porque el bug se reproduce solo. Mientras se escribía el
   * arreglo de las diez, main mergeó `order-transfer-request` (PR #1193): una
   * copia del molde de `customer-register`, con el `|| 'Mercatto'` y el
   * `[Mercatto]` del asunto incluidos. Arreglar las plantillas de a una es
   * perder la carrera contra el próximo copy-paste.
   *
   * Recorre el registro ENTERO, no una lista escrita a mano: una plantilla
   * nueva queda cubierta por el solo hecho de estar registrada.
   */
  const ofensores: string[] = [];
  for (const [key, fn] of Object.entries(templates as Record<string, unknown>)) {
    if (typeof fn !== 'function') continue;
    let out: { subject?: string; html?: string };
    try {
      out = (fn as (d: unknown) => { subject?: string; html?: string })({});
    } catch {
      // La plantilla exige datos que no tenemos acá; las suyas las cubren los
      // casos de arriba. No se puede afirmar nada, así que no se afirma.
      continue;
    }
    const texto = `${out?.subject ?? ''}\n${out?.html ?? ''}`;
    if (texto.includes(BRAND)) ofensores.push(key);
  }
  assert.deepEqual(
    ofensores,
    [],
    `estas plantillas nombran "${BRAND}" sin saber de qué tienda es: ${ofensores.join(', ')}`
  );
});

// ─── Los helpers, uno por uno ────────────────────────────────────────────────

test('storeDisplayName devuelve vacío cuando no sabemos de qué tienda es', () => {
  assert.equal(storeDisplayName({}), '');
  assert.equal(storeDisplayName({ cde_display_name: '' }), '');
  assert.equal(storeDisplayName({ cde_display_name: '   ' }), '');
  // El servicio inyecta `null` cuando la fila de branding está sin completar.
  assert.equal(storeDisplayName({ cde_display_name: null as unknown as string }), '');
});

test('storeDisplayName le saca el sufijo del canal al nombre visible', () => {
  // El canal se llama "Desde el sur-b2c" y el cliente no tiene por qué leer eso.
  assert.equal(storeDisplayName({ sales_channel_name: 'Desde el Sur-b2c' }), 'Desde el Sur');
  assert.equal(storeDisplayName({ sales_channel_name: 'Mercatto B2B' }), 'Mercatto');
  assert.equal(storeDisplayName({ cde_display_name: 'Desde el Sur' }), 'Desde el Sur');
});

test('storeDisplayName prefiere el nombre configurado por sobre el del canal', () => {
  assert.equal(
    storeDisplayName({ cde_display_name: 'Desde el Sur', sales_channel_name: 'raro-b2c' }),
    'Desde el Sur'
  );
});

test('subjectWithStore deja el asunto pelado si no hay tienda', () => {
  assert.equal(subjectWithStore('Confirmación de registro', {}), 'Confirmación de registro');
});

test('subjectWithStore conserva el canal crudo en el asunto', () => {
  // A PROPÓSITO: el asunto es lo único que ve un admin en la bandeja, y para
  // las notificaciones de órdenes distinguir B2B de B2C es información
  // operativa. El cuerpo sí usa el nombre limpio (`storeDisplayName`).
  assert.equal(
    subjectWithStore('Nueva orden', { sales_channel_name: 'Mercatto B2C' }),
    '[Mercatto B2C] Nueva orden'
  );
});

test('copyrightLine no firma cuando no hay quién firme', () => {
  assert.equal(copyrightLine(2026, ''), '© 2026. Todos los derechos reservados.');
  assert.equal(copyrightLine(2026, '   '), '© 2026. Todos los derechos reservados.');
  assert.equal(
    copyrightLine(2026, 'Desde el Sur'),
    '© 2026 Desde el Sur. Todos los derechos reservados.'
  );
});
