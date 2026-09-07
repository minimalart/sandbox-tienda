import { Container as UiContainer, clx } from '@medusajs/ui';
import type { ComponentProps } from 'react';

export type ContainerProps = ComponentProps<typeof UiContainer>;

export const Container = ({ className, ...props }: ContainerProps) => {
  return <UiContainer {...props} className={clx('divide-y p-0', className)} />;
};
