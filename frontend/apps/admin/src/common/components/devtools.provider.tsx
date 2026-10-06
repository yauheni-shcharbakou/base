'use client';

import React, { lazy, Suspense } from 'react';

// `@refinedev/devtools` is a devDependency: Next inlines `process.env.NODE_ENV` at build time, so a
// production bundle drops this branch and never resolves the import.
const Devtools =
  process.env.NODE_ENV === 'development'
    ? lazy(async () => {
        const { DevtoolsPanel, DevtoolsProvider: DevtoolsProviderBase } =
          // eslint-disable-next-line import-x/no-extraneous-dependencies -- dev-only branch, see above
          await import('@refinedev/devtools');

        return {
          default: (props: React.PropsWithChildren) => (
            <DevtoolsProviderBase>
              {props.children}
              <DevtoolsPanel />
            </DevtoolsProviderBase>
          ),
        };
      })
    : null;

export const DevtoolsProvider = (props: React.PropsWithChildren) => {
  if (!Devtools) {
    return props.children;
  }

  return (
    <Suspense fallback={props.children}>
      <Devtools>{props.children}</Devtools>
    </Suspense>
  );
};
