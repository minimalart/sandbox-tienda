import { Button, Heading, Text } from '@medusajs/ui';
import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type HeaderAction =
  | {
      type: 'button';
      props: ComponentProps<typeof Button>;
      link?: LinkProps;
    }
  | {
      type: 'custom';
      children: ReactNode;
    };

export type HeaderProps = {
  title: string;
  subtitle?: string;
  actions?: HeaderAction[];
};

export const Header = ({ title, subtitle, actions = [] }: HeaderProps) => {
  return (
    <div className="flex items-center justify-between px-2">
      <div>
        <Heading level="h2">{title}</Heading>
        {subtitle ? (
          <Text className="text-ui-fg-subtle" size="small">
            {subtitle}
          </Text>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <div className="flex items-center gap-x-2">
          {actions.map((action, index) => {
            if (action.type === 'custom') {
              return <div key={`custom-${index}`}>{action.children}</div>;
            }

            const button = (
              <Button key={`button-${index}`} size={action.props.size || 'small'} {...action.props}>
                {action.props.children}
              </Button>
            );

            if (action.link) {
              return (
                <Link key={`link-${index}`} {...action.link} className="inline-flex">
                  {button}
                </Link>
              );
            }

            return button;
          })}
        </div>
      ) : null}
    </div>
  );
};
