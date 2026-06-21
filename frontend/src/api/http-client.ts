// Hand-written fetch mutator used by the Orval-generated client. Editable (NOT generated).
// Orval's fetch client expects the mutator to resolve to { status, data, headers } where
// `data` is the parsed body — generated hooks read `.data` off that. On a non-2xx we throw an
// ApiError carrying the RFC 7807 ProblemDetail so TanStack Query routes it to onError.

// Default is same-origin ('') so requests hit `/api/...` on the dev server, where either MSW
// intercepts them (mock mode) or the Vite proxy forwards them to the real backend (integration
// mode). Set VITE_API_URL to an absolute origin to talk to a backend directly (needs CORS).
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** RFC 7807 problem detail body (application/problem+json). */
export interface ProblemDetail {
  type?: string | null;
  title?: string | null;
  status: number;
  detail: string;
  instance?: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: ProblemDetail | null,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function customFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  const contentType = res.headers.get('content-type') ?? '';
  let data: unknown = undefined;
  if (res.status !== 204) {
    data = contentType.includes('json')
      ? await res.json().catch(() => undefined)
      : await res.text().catch(() => undefined);
  }

  if (!res.ok) {
    const problem = contentType.includes('problem+json') ? (data as ProblemDetail) : null;
    throw new ApiError(res.status, problem, problem?.detail || res.statusText);
  }

  return { status: res.status, data, headers: res.headers } as T;
}
