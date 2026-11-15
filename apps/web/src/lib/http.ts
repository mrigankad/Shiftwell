/** One fetch client for every feature. Errors carry the daemon's own message when it sends one. */
export class HttpError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError((body as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) { init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify(body); }
  return fetch(url, init).then(json<T>);
}

export const http = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body: unknown = {}) => request<T>("POST", url, body),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body: unknown) => request<T>("PATCH", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
};
