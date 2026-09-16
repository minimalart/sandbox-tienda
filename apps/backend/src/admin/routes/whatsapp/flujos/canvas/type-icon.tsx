import {
  SparklesSolid,
  ChatBubbleLeftRight,
  CodeBranch,
  CogSixTooth,
  FlagMini,
  ListCheckbox,
  PencilSquare,
  PlaySolid,
  QueueList,
  User,
} from '@medusajs/icons';
import type { ComponentType, ReactElement } from 'react';

import type { NodeType } from '../_editor';

/**
 * EL CUADRADO DE COLOR CON EL ÍCONO DEL PASO.
 *
 * Es lo que identifica el tipo, y por eso es lo único que lleva color fuerte en una
 * tarjeta blanca. Reemplaza a las formas de diagrama recortadas con `clip-path`: una
 * forma no puede llevar un ícono adentro ni convivir con contenido, y el ícono se
 * reconoce más rápido que un trapecio.
 *
 * El mismo cuadrado se usa en la tarjeta, en la biblioteca de pasos y en el
 * encabezado del inspector, así que el operador ve el mismo símbolo en los tres
 * lugares donde se encuentra con un tipo de paso.
 */

type IconComponent = ComponentType<{ className?: string }>;

const ICON: Record<NodeType, IconComponent> = {
  start: PlaySolid,
  message: ChatBubbleLeftRight,
  ask_buttons: ListCheckbox,
  ask_list: QueueList,
  ask_text: PencilSquare,
  condition: CodeBranch,
  action: CogSixTooth,
  agent: SparklesSolid,
  handoff: User,
  end: FlagMini,
};

export type TypeIconSize = 'small' | 'medium';

const BOX: Record<TypeIconSize, number> = { small: 22, medium: 28 };

export function TypeIcon({
  type,
  background,
  color = '#FFFFFF',
  size = 'medium',
}: {
  type: NodeType;
  background: string;
  color?: string;
  size?: TypeIconSize;
}): ReactElement {
  const Icon = ICON[type];
  const lado = BOX[size];

  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: lado,
        height: lado,
        borderRadius: size === 'small' ? 6 : 8,
        background,
        color,
      }}
    >
      <Icon />
    </span>
  );
}
