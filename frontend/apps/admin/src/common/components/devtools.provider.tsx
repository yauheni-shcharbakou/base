'use client';

import { DevtoolsPanel, DevtoolsProvider as DevtoolsProviderBase } from '@refinedev/devtools';
import React from 'react';

const isDevelopment = process.env.NODE_ENV === 'development';

export const DevtoolsProvider = (props: React.PropsWithChildren) => {
  return (
    <DevtoolsProviderBase>
      {props.children}
      {isDevelopment && <DevtoolsPanel />}
    </DevtoolsProviderBase>
  );
};
