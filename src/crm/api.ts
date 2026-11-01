export interface CrmUser { id: number; name: string; email: string; role: string; status: string }
export interface Field { label: string; type: string; required?: boolean; resource?: string; options?: string[]; default?: string }
export interface Resource { title: string; section: string; fields: Record<string, Field>; can_write: boolean; can_delete: boolean; readonly_create?: boolean }
export interface Settings { company_name: string; currency: string }
export interface Metadata { resources: Record<string, Resource>; settings: Settings; user: CrmUser }
export type Row = Record<string, unknown> & { id: number; name?: string };
export interface Detail { data: Row; relations: Record<string, Row[]> }
let csrf = '';
export class ApiError extends Error {
  constructor(message: string, public status: number, public errors: Record<string, string[]> = {}) { super(message); }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch(`/api/${path}`, {
    method, credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(form ? {} : { 'Content-Type': 'application/json' }), ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}) },
    ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({ message: 'The server returned an unexpected response.' }));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('crm-signed-out'));
    throw new ApiError(data.message || 'Request failed.', response.status, data.errors);
  }
  if (data.csrf_token) csrf = data.csrf_token;
  return data as T;
}
export const label = (value: unknown) => String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
export const money = (value: unknown, currency: unknown = 'EGP') => new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency) }).format(Number(value ?? 0));
export function exportCsv(name: string, rows: Row[], columns: string[]) {
  const cell = (v: unknown) => { const s = String(v ?? ''); return `"${(/^[=+@\-\t\r]/.test(s) ? "'" : '') + s.replaceAll('"', '""')}"`; };
  const url = URL.createObjectURL(new Blob(['\ufeff' + [columns.map(label), ...rows.map(row => columns.map(key => row[`${key}_label`] ?? row[key]))].map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url);
}
