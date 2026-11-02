export interface CrmUser { id: number; name: string; email: string; role: string; status: string }
export interface Field { label: string; type: string; required?: boolean; resource?: string; options?: string[]; default?: string }
export interface Resource { title: string; section: string; fields: Record<string, Field>; can_write: boolean; can_delete: boolean; readonly_create?: boolean }
export interface Settings { company_name: string; currency: string }
export interface Metadata { resources: Record<string, Resource>; settings: Settings; user: CrmUser }
export type Row = Record<string, unknown> & { id: number; name?: string };
export interface Detail { data: Row; relations: Record<string, Row[]> }
let csrf = '';
const timestampKeys=new Set(['created_at','updated_at','reviewed_at','send_at','delivered_at','read_at','won_at','reservation_expires_at','mfa_confirmed_at','at']);
function normalizeDates(value:unknown,key=''):unknown {
  if(typeof value==='string' && timestampKeys.has(key) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value.replace(' ','T')+'Z';
  if(Array.isArray(value))return value.map(v=>normalizeDates(v));
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalizeDates(v,k)]));
  return value;
}
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
  const raw = await response.json().catch(() => ({ message: 'The server returned an unexpected response.' }));
  const data = normalizeDates(raw) as typeof raw;
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('crm-signed-out'));
    throw new ApiError(data.message || 'Request failed.', response.status, data.errors);
  }
  if (data.csrf_token) csrf = data.csrf_token;
  return data as T;
}
export const label = (value: unknown) => String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
export const money = (value: unknown, currency: unknown = 'EGP') => new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency) }).format(Number(value ?? 0));
export function exportCsv<T extends object>(name: string, rows: T[], columns: string[]) {
  const cell = (v: unknown) => { const s = String(v ?? ''); return `"${(/^[=+@\-\t\r]/.test(s) ? "'" : '') + s.replaceAll('"', '""')}"`; };
  const url = URL.createObjectURL(new Blob(['\ufeff' + [columns.map(label), ...rows.map(row => columns.map(key => (row as Record<string,unknown>)[`${key}_label`] ?? (row as Record<string,unknown>)[key]))].map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url);
}
