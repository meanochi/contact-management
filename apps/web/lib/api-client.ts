// The only way apps/web reaches apps/api (ARCHITECTURE-SPINE.md AD-12).
// Every Server Component fetch and every RTK Query baseQuery goes through
// this file — never an inline fetch() with a hardcoded URL in a component.
const API_BASE_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(body?.error?.message ?? `Request to ${path} failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}
