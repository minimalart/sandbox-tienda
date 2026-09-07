import type { FC, ReactNode } from 'react';

export const SafeHtml: FC<{ children: ReactNode }> = ({ children }) => {
  return <div>{children}</div>;
};
