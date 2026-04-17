/**
 * React Query Provider Wrapper
 * This wraps your Next.js app and provides the caching layer,
 * so if you click back and forth between residents, it loads instantly.
 */
"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // Cache data for 2 minutes
            refetchOnWindowFocus: false, // Don't refetch every time you click the browser tab
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
