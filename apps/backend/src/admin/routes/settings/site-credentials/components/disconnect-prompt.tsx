import { Button, Prompt } from '@medusajs/ui';
import type { SiteCredentialIntegration } from '../../../../hooks/api/site-credentials';

/**
 * Confirmación de "Desconectar cuenta propia": la única acción destructiva de esta
 * pantalla, y potencialmente la más cara — borra un secreto y puede apagar una
 * integración entera para la tienda.
 *
 * La consecuencia real depende de `isMainSite`, y ANTES de este archivo no se
 * miraba: el mensaje decía "vuelve a operar con las credenciales del entorno"
 * cada vez que `env_available` era `true`, sin importar si la tienda era
 * principal. Para una tienda NO principal eso es **falso** — la regla fail-closed
 * dice `site ?? OFF`, nunca `site ?? env`, así que desconectar la deja apagada
 * aunque el entorno tenga credenciales perfectamente buenas. Confirmar un borrado
 * creyendo que hay red de contención cuando no la hay es exactamente el escenario
 * que el dominio de esta pantalla existe para evitar (ver el docblock de
 * `integration-card.tsx`), así que el texto tiene que decir la verdad ANTES de que
 * el operador confirme, no en un toast después del hecho.
 *
 * Es un `<Prompt>` compuesto a mano y no el atajo `usePrompt()` que usa la mayoría
 * de las confirmaciones del admin (p. ej. `store-locations/components/
 * store-location-actions-menu.tsx`). Deliberado: `usePrompt()` cierra el diálogo
 * apenas el operador confirma y el borrado sigue en segundo plano sin feedback
 * visible más que un toast eventual. Para un secreto que puede apagar una
 * integración, mantener el diálogo abierto (con los botones deshabilitados) hasta
 * que el DELETE realmente termina es la diferencia entre "confirmé y no pasó nada
 * visible" y "confirmé, vi que estaba trabajando, y after certifiqué el resultado".
 * Mismo criterio que ya usan `delivery/*` y `media-library` para diálogos con
 * contenido rico.
 */

type Props = {
  integration: SiteCredentialIntegration;
  siteName: string;
  /** La tienda activa es la principal. Determina si desconectar hereda o apaga. */
  isMainSite: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Deshabilita el botón que abre el diálogo (hay otra mutación en curso). */
  triggerDisabled: boolean;
  /** El DELETE está en vuelo: se deshabilitan Cancelar/Desconectar, no se cierra solo. */
  confirming: boolean;
  onConfirm: () => void;
};

export const DisconnectPrompt = ({
  integration,
  siteName,
  isMainSite,
  open,
  onOpenChange,
  triggerDisabled,
  confirming,
  onConfirm,
}: Props) => {
  const consequence = !isMainSite
    ? `Se borran las credenciales propias de ${siteName}. Esta tienda NO es la principal, así que NO cae a las credenciales del entorno aunque existan: la integración queda APAGADA para ${siteName} hasta que cargues una cuenta propia de nuevo.`
    : integration.env_available
      ? `Se borran las credenciales propias de ${siteName}. A partir de ahí esta tienda vuelve a operar con las credenciales del entorno, las mismas que el resto de las tiendas.`
      : `Se borran las credenciales propias de ${siteName} y NO hay credenciales de entorno que la reemplacen: la integración deja de funcionar para esta tienda.`;

  return (
    <Prompt open={open} onOpenChange={onOpenChange} variant="danger">
      <Prompt.Trigger asChild>
        <Button variant="secondary" size="small" disabled={triggerDisabled}>
          Desconectar cuenta propia
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Desconectar {integration.label}</Prompt.Title>
          <Prompt.Description>{consequence}</Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel disabled={confirming}>Cancelar</Prompt.Cancel>
          <Prompt.Action
            disabled={confirming}
            onClick={(event) => {
              // El Action cierra el diálogo solo; se corta para que sea el
              // resultado del DELETE —no el click— el que decide, y para poder
              // mostrar el error del backend en la card si falla.
              event.preventDefault();
              onConfirm();
            }}
          >
            Desconectar
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};
