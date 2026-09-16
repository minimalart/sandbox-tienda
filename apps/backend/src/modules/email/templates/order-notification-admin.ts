import type {EmailTemplateFunction, EmailTemplateResult} from './types';
import {formatLineTotalForEmail, getIconTag, hexToRgba} from './email-helpers';

export type OrderItemForEmail = {
    title?: string;
    variant_title?: string;
    /** Color entonado ya armado ("Brisa Chic (82YR 83/056)"). Ausente si no va entonada. */
    color_label?: string;
    /** Hex de la carta, validado como `#RRGGBB`. Ausente cuando no se conoce. */
    color_hex?: string;
    quantity?: number;
    unit_price?: number;
    unit_price_formatted?: string;
    line_total_formatted?: string;
    thumbnail?: string;
};

export type OrderAddressForEmail = {
    first_name?: string;
    last_name?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    province?: string;
    postal_code?: string;
    country_code?: string;
    phone?: string;
};

export type OrderNotificationAdminData = {
    order_id?: string;
    display_id?: string | number;
    custom_display_id?: string;
    total?: string | number;
    customer_email?: string;
    customer_name?: string;
    is_draft_order?: boolean;
    sales_channel_id?: string;
    sales_channel_name?: string;
    /** 'customer' = quien realizó la orden; 'creator' = admin / quien generó o aprobó */
    recipient_type?: 'customer' | 'creator';
    logo_url?: string;
    cde_display_name?: string;
    order_date_formatted?: string;
    order_items?: OrderItemForEmail[];
    subtotal_formatted?: string;
    shipping_formatted?: string;
    tax_formatted?: string;
    discounts?: Array<{label: string; amount_formatted: string; makes_free?: boolean}>;
    discount_total_formatted?: string;
    shipping_address?: OrderAddressForEmail;
    billing_address?: OrderAddressForEmail;
    shipping_method_name?: string;
    payment_method_name?: string;
    customer_phone?: string;
    order_notes?: string;
    is_quotation_approval?: boolean;
    is_internal_order?: boolean;
    primary_color?: string;
    kit_pickup_qr_url?: string;
    kit_pickup_url?: string;
    kit_pickup_cde?: {
        id?: string;
        name?: string;
        street?: string;
        city?: string;
        province?: string;
        phone?: string;
        business_hours?: Record<string, unknown> | null;
    };
    [key: string]: unknown;
};

function fmt(value: string | number | undefined): string {
    if (value === undefined || value === null) return '—';
    return String(value);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Quita sufijos en inglés/español del nombre de la provincia para dejar solo el nombre real.
 * Ej: "Corrientes Province" → "Corrientes", "Provincia de Buenos Aires" → "Buenos Aires".
 */
function cleanProvinceName(province: string): string {
    return province
        .replace(/^Provincia\s+de\s+/i, '')
        .replace(/\s+Province$/i, '')
        .replace(/\s+Provincia$/i, '')
        .trim();
}

/**
 * Formatea la dirección como una sola línea: "address_1, address_2, city, province, postal_code".
 * Limpia el sufijo "Province" del campo provincia.
 */
function formatAddressOneLine(addr?: OrderAddressForEmail): string {
    if (!addr) return '';
    const parts: string[] = [];
    const street = [addr.address_1, addr.address_2].filter(Boolean).join(', ').trim();
    if (street) parts.push(street);
    if (addr.city) parts.push(addr.city.trim());
    if (addr.province) {
        const clean = cleanProvinceName(addr.province);
        if (clean) parts.push(clean);
    }
    if (addr.postal_code) parts.push(addr.postal_code.trim());
    return parts.join(', ');
}

/**
 * Plantilla para notificación de orden — diseño con tarjetas outlined.
 * Customer: "¡Muchas gracias por tu compra!" + QR si hay pickup.
 * Creator/admin: "Nueva orden de compra" + info CDE sin QR.
 */
export const orderNotificationAdminTemplate: EmailTemplateFunction<OrderNotificationAdminData> = (
    data
): EmailTemplateResult => {
    const displayId = data.custom_display_id ?? data.display_id ?? data.order_id ?? '';
    const total = fmt(data.total);
    const channelName = data.sales_channel_name || data.sales_channel_id || '';
    const isCustomer = data.recipient_type === 'customer';
    const customerName = (data.customer_name || '').trim();
    const logoUrl = data.logo_url || '';
    const cdeDisplayName = (data.cde_display_name || channelName || 'CDE').trim();
    const orderDate = data.order_date_formatted || '';
    const items = Array.isArray(data.order_items) ? data.order_items : [];
    const subtotal = data.subtotal_formatted ?? total;
    const discounts = Array.isArray(data.discounts)
        ? data.discounts.filter((d) => d && d.amount_formatted && d.amount_formatted !== '—' && d.amount_formatted !== '0')
        : [];
    const hasDiscounts = discounts.length > 0;
    const rawShipping = (data.shipping_formatted ?? '').trim();
    const isShippingFree = rawShipping === '' || rawShipping === '0' || rawShipping === '0,00' || rawShipping === '—';
    const shippingDisplay = isShippingFree ? 'Gratis' : `$ ${rawShipping}`;
    const isQuotationApproval = !!data.is_quotation_approval;
    const isInternalCreator = !!data.is_internal_order && !isCustomer;
    const kitPickupQr = data.kit_pickup_qr_url || '';
    const kitPickupCde = data.kit_pickup_cde || null;
    const hasKitPickupCde = !!kitPickupCde;
    const hasKitPickupQr = !!(kitPickupQr && kitPickupCde);
    const primaryColor = (data.primary_color as string | undefined) || '#2e7d32';
    const primaryColorBg = hexToRgba(primaryColor, 0.1);
    const cardBorderColor = '#e5e7eb';

    const subject = isQuotationApproval
        ? 'Se aceptó la cotización'
        : isCustomer
            ? 'Realizaste una nueva orden'
            : isInternalCreator
                ? 'Se generó una nueva orden interna'
                : 'Nueva orden de compra';

    const titleMain = isQuotationApproval
        ? 'Se aceptó la cotización'
        : isCustomer
            ? (customerName ? `¡Muchas gracias ${customerName} por tu compra!` : '¡Muchas gracias por tu compra!')
            : isInternalCreator
                ? 'Se generó una nueva orden interna'
                : 'Nueva orden de compra';
    const titleSub = isQuotationApproval
        ? (isCustomer ? 'Tu pedido está confirmado' : 'La cotización fue aceptada. Detalles a continuación')
        : isCustomer
            ? 'Tu pedido se ha procesado correctamente'
            : 'Detalles del pedido a continuación';

    const year = new Date().getFullYear();

    // Iconos (set provisto por diseño — ver images/icons/)
    const iconUser = getIconTag('user.png', '', 20, 20);
    const iconEmail = getIconTag('email.png', '', 20, 20);
    const iconPhone = getIconTag('heroicons-phone.png', '', 20, 20);
    const iconLocation = getIconTag('heroicons-map-pin.png', '', 20, 20);
    const iconLocal = getIconTag('heroicons-building-storefront.png', '', 20, 20);
    const iconTruck = getIconTag('truck.png', '', 20, 20);
    const iconCard = getIconTag('card.png', '', 20, 20);

    // Datos derivados
    const shippingAddress = data.shipping_address;
    const shippingAddressOneLine = formatAddressOneLine(shippingAddress);
    const rawShippingMethodName = (data.shipping_method_name || '').trim();
    const shippingMethodName = data.is_internal_order
        ? 'Retiro por logística interna'
        : rawShippingMethodName;
    const paymentMethodName = (data.payment_method_name || '').trim();
    const customerPhone = (data.customer_phone || '').trim();
    const customerEmailForCard = (data.customer_email || '').trim();
    const orderNotes = (data.order_notes || '').trim();

    const hasCustomerInfo = !!customerName || !!customerEmailForCard || !!customerPhone;
    const hasShippingCardInfo = !!shippingAddressOneLine || !!shippingMethodName || !!paymentMethodName || hasKitPickupCde;

    // ─── Helpers de renderizado ────────────────────────────────────────────

    /**
     * Fila simple "icono + valor" (sin label intermedio). Usada en la card del cliente
     * y en la línea de dirección del envío.
     *
     * Importante: la card del envío mezcla filas de 2 y 3 columnas. Para que Gmail
     * y Outlook no calculen mal los anchos, esta fila usa colspan=2 en el value
     * para ocupar el espacio del label+value de las filas etiquetadas.
     */
    const renderIconValueRow = (icon: string, value: string, opts: {bold?: boolean} = {}): string => `
                                    <tr>
                                        <td style="padding: 8px 0; width: 32px; vertical-align: top; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${icon}</td>
                                        <td colspan="2" style="padding: 8px 0 8px 12px; vertical-align: top; color: #333333; font-size: 13px; line-height: 1.5; ${opts.bold ? 'font-weight: bold;' : ''} mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${value}</td>
                                    </tr>`;

    /**
     * Fila "icono + label gris izquierdo + valor bold a la derecha". Usada en
     * métodos de envío/pago y en la sub-sección del CDE.
     *
     * El label tiene width fijo (130px) para que el valor bold tenga la mayor
     * cantidad de ancho posible y no se rompa en varias líneas.
     */
    const renderIconLabelValueRow = (icon: string, label: string, value: string): string => `
                                    <tr>
                                        <td style="padding: 8px 0; width: 32px; vertical-align: top; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${icon}</td>
                                        <td style="padding: 8px 0 8px 12px; width: 130px; vertical-align: top; color: #666666; font-size: 13px; line-height: 1.4; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${escapeHtml(label)}</td>
                                        <td style="padding: 8px 0 8px 8px; vertical-align: top; color: #111111; font-size: 12px; font-weight: bold; text-align: right; line-height: 1.4; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${escapeHtml(value)}</td>
                                    </tr>`;

    /**
     * Wrapper de tarjeta outlined (borde gris + radius). Recibe el contenido
     * interno (debe ser <tr>s ya formateados por los renderers) y un título
     * en color primario.
     */
    const renderOutlinedCard = (title: string, innerRows: string): string => `
                    <tr>
                        <td style="padding: 0 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid ${cardBorderColor}; border-radius: 14px; border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 20px 24px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <h3 style="margin: 0 0 12px 0; font-size: 16px; color: ${primaryColor}; font-weight: bold;">${escapeHtml(title)}</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                            ${innerRows}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>`;

    /**
     * Subtítulo dentro de una card existente (color primario). Renderiza una
     * fila con un h4 y un pequeño espacio superior. Usado para "Centro de
     * distribución seleccionado" dentro de la card del envío.
     */
    const renderCardSubtitle = (title: string): string => `
                                    <tr>
                                        <td colspan="3" style="padding: 16px 0 4px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                            <h4 style="margin: 0; font-size: 14px; color: ${primaryColor}; font-weight: bold;">${escapeHtml(title)}</h4>
                                        </td>
                                    </tr>`;

    // ─── Cards ─────────────────────────────────────────────────────────────

    // Datos del cliente
    const customerCardRows = [
        customerName ? renderIconValueRow(iconUser, escapeHtml(customerName)) : '',
        customerEmailForCard ? renderIconValueRow(iconEmail, escapeHtml(customerEmailForCard)) : '',
        customerPhone ? renderIconValueRow(iconPhone, escapeHtml(customerPhone)) : '',
    ].filter(Boolean).join('');
    const customerCard = hasCustomerInfo ? renderOutlinedCard('Datos del cliente', customerCardRows) : '';

    // Datos del envío (incluye CDE si aplica)
    const shippingRows = [
        shippingAddressOneLine
            ? renderIconValueRow(iconLocation, escapeHtml(shippingAddressOneLine))
            : '',
        shippingMethodName
            ? renderIconLabelValueRow(iconTruck, 'Método de envío', shippingMethodName)
            : '',
        paymentMethodName
            ? renderIconLabelValueRow(iconCard, 'Método de pago', paymentMethodName)
            : '',
        hasKitPickupCde ? renderCardSubtitle('Centro de distribución seleccionado') : '',
        hasKitPickupCde && kitPickupCde?.name
            ? renderIconLabelValueRow(iconLocal, 'Local', kitPickupCde.name)
            : '',
        hasKitPickupCde
            ? renderIconLabelValueRow(
                iconLocation,
                'Dirección',
                [kitPickupCde?.street, kitPickupCde?.city, kitPickupCde?.province].filter(Boolean).join(', ')
            )
            : '',
        hasKitPickupCde && kitPickupCde?.phone
            ? renderIconLabelValueRow(iconPhone, 'Teléfono', kitPickupCde.phone)
            : '',
    ].filter(Boolean).join('');
    const shippingCard = hasShippingCardInfo ? renderOutlinedCard('Datos del envío', shippingRows) : '';

    // Observaciones
    const notesCard = orderNotes
        ? renderOutlinedCard(
            'Observaciones',
            `<tr><td style="padding: 4px 0; color: #333333; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(orderNotes)}</td></tr>`
        )
        : '';

    // ─── Items ─────────────────────────────────────────────────────────────

    const itemsRows = items
        .map(
            (item) => `
                    <tr>
                        <td style="padding: 0 40px 12px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 12px; width: 80px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        ${item.thumbnail ? `<img src="${item.thumbnail}" alt="${fmt(item.title)}" width="68" style="display: block; border-radius: 4px; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">` : ''}
                                    </td>
                                    <td style="padding: 12px 12px 12px 4px; vertical-align: middle; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0 0 4px 0; font-size: 15px; color: #333333; font-weight: bold;">${fmt(item.title)}</p>
                                        ${item.color_label ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 4px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;"><tr><td width="12" height="12" style="width: 12px; height: 12px; background-color: ${escapeHtml(item.color_hex && /^#[0-9A-Fa-f]{6}$/.test(item.color_hex) ? item.color_hex : '#d1d5db')}; border: 1px solid #e5e7eb; font-size: 0; line-height: 0;">&nbsp;</td><td style="padding-left: 6px; font-size: 13px; color: #666666;">Color: ${escapeHtml(item.color_label)}</td></tr></table>` : ''}
                                        <p style="margin: 0; font-size: 13px; color: #666666;">${fmt(item.quantity)} x $ ${fmt(item.unit_price_formatted ?? item.unit_price)}</p>
                                    </td>
                                    <td style="padding: 12px; text-align: right; vertical-align: middle; font-size: 15px; color: #333333; font-weight: bold; white-space: nowrap; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        ${formatLineTotalForEmail(item.line_total_formatted ?? item.unit_price_formatted ?? item.unit_price)}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>`
        )
        .join('');

    const hasItems = itemsRows.length > 0;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; width: 100%; font-family: 'Inter', Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5; font-family: 'Inter', Arial, sans-serif; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
        <tr>
            <td style="padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; background-color: #ffffff; max-width: 600px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 40px 20px 12px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            ${logoUrl ? `<img src="${logoUrl}" alt="${cdeDisplayName}" width="170" style="display: block; margin: 0 auto; -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none;">` : `<div style="font-size: 24px; font-weight: 700; color: ${primaryColor};">${cdeDisplayName}</div>`}
                        </td>
                    </tr>

                    <!-- Título -->
                    <tr>
                        <td style="padding: 12px 20px 8px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h1 style="margin: 0; font-size: 24px; color: #111111; font-weight: bold;">${titleMain}</h1>
                        </td>
                    </tr>

                    <!-- Subtítulo -->
                    <tr>
                        <td style="padding: 0 20px 24px 20px; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; font-size: 14px; color: #666666;">${titleSub}</p>
                        </td>
                    </tr>

                    <!-- Pedido y Fecha -->
                    <tr>
                        <td style="padding: 8px 40px 20px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="text-align: left; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <span style="display: inline-block; padding: 8px 18px; background-color: #ffffff; border: 1.2px solid ${primaryColor}; border-radius: 20px; color: ${primaryColor}; font-size: 13px; font-weight: bold;">Pedido <span style="font-weight: bold;">#${displayId}</span></span>
                                    </td>
                                    ${orderDate ? `<td style="text-align: right; color: #666666; font-size: 13px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${orderDate}</td>` : ''}
                                </tr>
                            </table>
                        </td>
                    </tr>

                    ${customerCard}

                    <!-- Resumen del pedido -->
                    ${hasItems ? `
                    <tr>
                        <td style="padding: 4px 40px 12px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h2 style="margin: 0; font-size: 16px; color: ${primaryColor}; font-weight: bold;">Resumen del pedido</h2>
                        </td>
                    </tr>
                    ${itemsRows}
                    ` : ''}

                    <!-- Subtotal y Envío -->
                    ${hasItems ? `
                    <tr>
                        <td style="padding: 4px 40px 8px 40px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 6px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Subtotal</td>
                                    <td style="padding: 6px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ ${subtotal}</td>
                                </tr>
                                ${hasDiscounts ? discounts.map((d) => `
                                <tr>
                                    <td style="padding: 6px 0; color: #15803d; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${escapeHtml(d.label)}</td>
                                    <td style="padding: 6px 0; text-align: right; color: #15803d; font-size: 14px; font-weight: 600; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${d.makes_free ? 'Gratis' : `-$ ${escapeHtml(d.amount_formatted)}`}</td>
                                </tr>`).join('') : ''}
                                <tr>
                                    <td style="padding: 6px 0; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Envío</td>
                                    <td style="padding: 6px 0; text-align: right; color: #666666; font-size: 14px; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">${shippingDisplay}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Total -->
                    <tr>
                        <td style="padding: 8px 40px 24px 40px; border-top: 1px solid ${cardBorderColor}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="padding: 8px 0; color: #111111; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">Total del pedido</td>
                                    <td style="padding: 8px 0; text-align: right; color: #111111; font-size: 18px; font-weight: bold; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">$ ${total}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    ${shippingCard}

                    ${notesCard}

                    ${hasKitPickupQr && isCustomer ? `
                    <!-- Punto de retiro (QR — solo customer) -->
                    <tr>
                        <td style="padding: 24px 40px 28px 40px; background-color: ${primaryColorBg}; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <h2 style="margin: 0 0 6px 0; font-size: 16px; color: ${primaryColor}; font-weight: bold;">Punto de retiro</h2>
                            <p style="margin: 0 0 16px 0; font-size: 13px; color: #666666;">Presentá este código QR cuando vayas a retirar tu pedido.</p>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td style="text-align: center; padding: 10px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <img src="${kitPickupQr}" alt="Código QR" width="220" height="220" style="display: block; margin: 0 auto; border: 1px solid #ddd; background: white; padding: 10px; -ms-interpolation-mode: bicubic; line-height: 100%; outline: none; text-decoration: none;">
                                    </td>
                                </tr>
                                ${data.kit_pickup_url ? `
                                <tr>
                                    <td style="text-align: center; padding: 10px 0 0 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                        <p style="margin: 0; font-size: 13px; color: #666666;">
                                            ¿No ves el QR? <a href="${data.kit_pickup_url}" style="color: ${primaryColor}; text-decoration: underline; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">Abrilo en el navegador</a>
                                        </p>
                                    </td>
                                </tr>` : ''}
                            </table>
                        </td>
                    </tr>` : ''}

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 18px; background-color: ${primaryColor}; text-align: center; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                            <p style="margin: 0; color: #ffffff; font-size: 12px;">© ${year} ${cdeDisplayName}. Todos los derechos reservados.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`.trim();

    const channel = `[${channelName}] `;
    const channelCondition = channelName == "Mercatto B2C" ? "" : channel;
    return {
        subject: channelName ? `${channelCondition}${subject} #${displayId}` : `[Mercatto] ${subject} #${displayId}`,
        html,
    };
};
