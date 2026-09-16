/** Problem+json from the API, carrying the machine-readable code the UI branches on. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  constructor(status: number, code: string, title: string, detail: string) {
    super(detail || title);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail || title;
  }
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface ClientOptions {
  baseUrl: string;
  /** Read the current access token. Returning null sends the request unauthenticated. */
  token: () => string | null;
  /** Called when the API rejects the token, so the app can drop its session. */
  onUnauthorized?: () => void;
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly token: () => string | null;
  private readonly onUnauthorized?: () => void;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.onUnauthorized = options.onUnauthorized;
  }

  /** Absolute URL for a path the API returned, such as an uploaded photo. */
  url(path: string): string {
    return path.startsWith('http') ? path : `${this.baseUrl}${path}`;
  }

  async request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const headers: Record<string, string> = {};
    const token = this.token();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(this.baseUrl + path + queryString(query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return this.unwrap<T>(res, method, path);
  }

  /** Walks the cursor until the API stops handing one back. */
  async list<T>(path: string, query?: Query): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null = null;
    do {
      const page: Page<T> = await this.request<Page<T>>('GET', path, undefined, { ...query, limit: 200, cursor });
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return items;
  }

  async upload(file: File): Promise<{ url: string; contentType: string; bytes: number }> {
    const form = new FormData();
    form.append('file', file);
    const headers: Record<string, string> = {};
    const token = this.token();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${this.baseUrl}/uploads`, { method: 'POST', headers, body: form });
    return this.unwrap(res, 'POST', '/uploads');
  }

  private async unwrap<T>(res: Response, method: string, path: string): Promise<T> {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const parsed: unknown = text ? safeParse(text) : null;
    if (res.ok) return parsed as T;
    if (res.status === 401) this.onUnauthorized?.();
    const problem = (parsed ?? {}) as { code?: string; title?: string; detail?: string };
    throw new ApiError(
      res.status,
      problem.code ?? 'REQUEST_FAILED',
      problem.title ?? `${method} ${path} failed`,
      problem.detail ?? text.slice(0, 200),
    );
  }
}

function queryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
