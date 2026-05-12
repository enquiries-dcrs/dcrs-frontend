import axios from "axios";

/** Thrown from React Query `queryFn` so the UI can show heading + body without re-parsing Axios. */
export class DcrsFetchError extends Error {
  constructor(
    public readonly heading: string,
    detail: string,
  ) {
    super(detail);
    this.name = "DcrsFetchError";
  }
}

export function throwFormattedApiError(err: unknown): never {
  const { title, detail } = formatApiError(err);
  throw new DcrsFetchError(title, detail);
}

export function formatApiError(err: unknown): { title: string; detail: string } {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const body = err.response?.data as { error?: string; message?: string } | undefined;
    const msg = (body?.error || body?.message || err.message || '').trim();

    if (status === 401) {
      return {
        title: 'Sign-in required',
        detail:
          'No valid session was sent to the API. Refresh this page and sign in again, or confirm Supabase env vars match your project.',
      };
    }
    if (status === 403) {
      return {
        title: 'Access denied',
        detail: msg || 'You may not have permission to open this service user record.',
      };
    }
    if (status === 404) {
      return {
        title: 'Service user not found',
        detail:
          msg ||
          'This ID is not available in your scope, or the record does not exist. Try the Service users list again.',
      };
    }
    if (status === 503) {
      return {
        title: 'Service temporarily unavailable',
        detail: msg || 'The API reported a missing migration or dependency. Check server logs.',
      };
    }
    if (!err.response) {
      return {
        title: 'Cannot reach API',
        detail:
          `Request to ${err.config?.baseURL || 'API'} failed (${err.message}). Confirm the backend is running and NEXT_PUBLIC_API_URL matches it (e.g. http://127.0.0.1:4000).`,
      };
    }
    return {
      title: `Request failed (${status ?? 'error'})`,
      detail: msg || err.message || 'Unexpected error from server.',
    };
  }
  if (err instanceof DcrsFetchError) {
    return { title: err.heading, detail: err.message };
  }
  if (err instanceof Error) {
    return { title: "Something went wrong", detail: err.message };
  }
  return { title: "Something went wrong", detail: "Unknown error" };
}
