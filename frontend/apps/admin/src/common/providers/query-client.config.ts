'use client';

import { getQueryRetryDelay } from '@/common/helpers/query-retry';
import type { QueryClientConfig } from '@tanstack/react-query';

/**
 * The `QueryClient` Refine builds, shared by every query of the admin: each waits out the
 * gateway's rate limit for as long as it says. A client module: the root layout is a server
 * component, and a function it passed to `<Refine>` itself would not cross to the browser.
 */
export const queryClientConfig: QueryClientConfig = {
  defaultOptions: { queries: { retryDelay: getQueryRetryDelay } },
};
