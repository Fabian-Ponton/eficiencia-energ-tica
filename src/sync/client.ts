import type { CloudSession } from '@/domain/types';

/**
 * Cliente mínimo de Supabase por HTTP (Auth, PostgREST y Storage), sin librerías: la app sigue liviana
 * y funciona igual sin conexión. Solo usa la URL y la clave pública «anon» del proyecto del usuario;
 * lo que cada quien puede ver o cambiar lo limitan las políticas RLS del SQL de PONTIA.
 */

export const RECORDS_TABLE = 'pontia_records';
export const PHOTO_BUCKET = 'pontia-fotos';

export class CloudError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}

/** Una fila de `pontia_records`: un registro de la app con su dueño, su fecha de cambio y su marca de borrado. */
export interface CloudRow {
  owner: string;
  table_name: string;
  id: string;
  project_id: string;
  data: Record<string, unknown>;
  updated_at: number;
  deleted_at: number | null;
  server_seq?: number;
}

export interface CloudClient {
  /** Comprueba que la URL y la clave anon corresponden a un proyecto de Supabase. */
  ping(): Promise<void>;
  signIn(email: string, password: string): Promise<CloudSession>;
  /** Crea la cuenta; `null` si Supabase pide confirmar el correo antes de entrar. */
  signUp(email: string, password: string): Promise<CloudSession | null>;
  refresh(session: CloudSession): Promise<CloudSession>;
  signOut(session: CloudSession): Promise<void>;
  upsert(session: CloudSession, rows: readonly CloudRow[]): Promise<void>;
  /** Filas con secuencia mayor que `afterSeq`, en orden de secuencia. */
  pull(session: CloudSession, afterSeq: number, limit: number): Promise<CloudRow[]>;
  uploadPhoto(session: CloudSession, path: string, blob: Blob): Promise<void>;
  downloadPhoto(session: CloudSession, path: string): Promise<Blob>;
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email?: string };
}

/** Los mensajes de Supabase más comunes al configurar, en español y con qué hacer. */
export function explainCloudError(status: number, body: string): string {
  let detail = '';
  try {
    const json = JSON.parse(body) as { msg?: string; message?: string; error_description?: string; error?: string };
    detail = json.error_description ?? json.msg ?? json.message ?? json.error ?? '';
  } catch {
    detail = body.slice(0, 200);
  }
  if (/invalid login credentials/i.test(detail)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(detail)) return 'Falta confirmar el correo: abre el enlace que te envió Supabase y vuelve a entrar.';
  if (/already registered|already exists/i.test(detail)) return 'Ese correo ya tiene cuenta: usa «Entrar».';
  if (/password should be at least/i.test(detail)) return 'La contraseña es muy corta: usa al menos 6 caracteres.';
  if (/invalid api key|no api key/i.test(detail)) return 'La clave anon no corresponde a esa URL: cópiala de nuevo desde Supabase.';
  if (/does not exist|could not find the table/i.test(detail)) return 'Falta preparar la base: ejecuta el SQL de PONTIA en tu proyecto de Supabase.';
  if (/row-level security/i.test(detail)) return 'Las políticas de seguridad no permiten la operación: ejecuta el SQL completo de PONTIA.';
  if (/bucket not found/i.test(detail)) return 'Falta el depósito de fotos «pontia-fotos»: ejecuta el SQL completo de PONTIA.';
  if (/jwt expired/i.test(detail)) return 'La sesión venció: vuelve a entrar con tu cuenta.';
  return detail ? `${detail} (código ${status})` : `La nube respondió con el código ${status}.`;
}

export function createCloudClient(url: string, anonKey: string, fetcher: typeof fetch = (...args) => fetch(...args)): CloudClient {
  const base = url.trim().replace(/\/+$/, '');
  const headers = (token?: string, extra: Record<string, string> = {}): Record<string, string> => ({
    apikey: anonKey,
    Authorization: `Bearer ${token ?? anonKey}`,
    ...extra,
  });
  const json = { 'Content-Type': 'application/json' };

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, init);
    } catch {
      throw new CloudError('No hay conexión con la nube: revisa internet y la URL del proyecto.', 0);
    }
    if (!response.ok) throw new CloudError(explainCloudError(response.status, await response.text()), response.status);
    return response;
  }

  const toSession = (auth: AuthResponse): CloudSession => {
    if (!auth.access_token || !auth.refresh_token || !auth.user) throw new CloudError('Supabase no devolvió una sesión.', 500);
    return {
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      expiresAt: Date.now() + (auth.expires_in ?? 3600) * 1000,
      userId: auth.user.id,
      email: auth.user.email ?? '',
    };
  };

  return {
    async ping() {
      await call('/auth/v1/settings', { headers: headers() });
    },
    async signIn(email, password) {
      const response = await call('/auth/v1/token?grant_type=password', { method: 'POST', headers: headers(undefined, json), body: JSON.stringify({ email, password }) });
      return toSession((await response.json()) as AuthResponse);
    },
    async signUp(email, password) {
      const response = await call('/auth/v1/signup', { method: 'POST', headers: headers(undefined, json), body: JSON.stringify({ email, password }) });
      const auth = (await response.json()) as AuthResponse;
      return auth.access_token ? toSession(auth) : null;
    },
    async refresh(session) {
      const response = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: headers(undefined, json), body: JSON.stringify({ refresh_token: session.refreshToken }) });
      return toSession((await response.json()) as AuthResponse);
    },
    async signOut(session) {
      // Si la sesión ya venció, cerrar aquí basta
      await call('/auth/v1/logout', { method: 'POST', headers: headers(session.accessToken) }).catch(() => undefined);
    },
    async upsert(session, rows) {
      if (!rows.length) return;
      await call(`/rest/v1/${RECORDS_TABLE}?on_conflict=owner,table_name,id`, {
        method: 'POST',
        headers: headers(session.accessToken, { ...json, Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(rows),
      });
    },
    async pull(session, afterSeq, limit) {
      const query = new URLSearchParams({
        select: 'owner,table_name,id,project_id,data,updated_at,deleted_at,server_seq',
        server_seq: `gt.${afterSeq}`,
        order: 'server_seq.asc',
        limit: String(limit),
      });
      const response = await call(`/rest/v1/${RECORDS_TABLE}?${query}`, { headers: headers(session.accessToken) });
      return (await response.json()) as CloudRow[];
    },
    async uploadPhoto(session, path, blob) {
      await call(`/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
        method: 'POST',
        headers: headers(session.accessToken, { 'Content-Type': blob.type || 'image/jpeg', 'x-upsert': 'true' }),
        body: blob,
      });
    },
    async downloadPhoto(session, path) {
      const response = await call(`/storage/v1/object/authenticated/${PHOTO_BUCKET}/${path}`, { headers: headers(session.accessToken) });
      return response.blob();
    },
  };
}
